"""
Databricks PySpark Pipeline: GSTR Reconciliation & Circular Trading Detection
Implements the Medallion Architecture (Bronze -> Silver -> Gold).

This script is designed to run on a Databricks cluster natively and be
triggered by the FastAPI backend when a new B2B institutional payload arrives.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum, abs, when, lit, count

spark = SparkSession.builder.appName("GST_Reconciliation_Pipeline").getOrCreate()

# ==============================================================================
# 1. BRONZE LAYER: Raw Data Ingestion
# ==============================================================================
def load_bronze_layer(tenant_id: str, analysis_id: str):
    """
    Load raw JSON/CSV dumps of GSTR-2A (Purchases) and GSTR-3B (Sales summary)
    Payloads injected from the API gateway into a cloud storage landing zone.
    """
    gstr2a_raw = spark.read.format("json").load(f"s3://intelli-credit/landing/{tenant_id}/{analysis_id}/gstr2a/")
    gstr3b_raw = spark.read.format("json").load(f"s3://intelli-credit/landing/{tenant_id}/{analysis_id}/gstr3b/")
    bank_raw = spark.read.format("csv").option("header", "true").load(f"s3://intelli-credit/landing/{tenant_id}/{analysis_id}/bank_txns/")

    # Write to Bronze Delta tables for immutable raw audit trails
    gstr2a_raw.write.format("delta").mode("overwrite").saveAsTable(f"bronze.gstr2a_{tenant_id}")
    gstr3b_raw.write.format("delta").mode("overwrite").saveAsTable(f"bronze.gstr3b_{tenant_id}")
    bank_raw.write.format("delta").mode("overwrite").saveAsTable(f"bronze.bank_{tenant_id}")


# ==============================================================================
# 2. SILVER LAYER: Cleansed & Structuring Data
# ==============================================================================
def process_silver_layer(tenant_id: str):
    """
    Cleanse dates, standardize GSTINs, remove duplicate filings, and handle data types.
    """
    gstr2a_df = spark.table(f"bronze.gstr2a_{tenant_id}")
    gstr3b_df = spark.table(f"bronze.gstr3b_{tenant_id}")
    bank_df = spark.table(f"bronze.bank_{tenant_id}")

    # Standardize GSTR-2A (supplier line items)
    gstr2a_clean = gstr2a_df.select(
        col("gstin_supplier").alias("supplier_gstin"),
        col("invoice_number").cast("string"),
        col("invoice_date").cast("date"),
        col("taxable_value").cast("double"),
        col("igst").cast("double").alias("igst_amount"),
        col("cgst").cast("double").alias("cgst_amount"),
        col("sgst").cast("double").alias("sgst_amount")
    ).dropDuplicates(["supplier_gstin", "invoice_number"])

    # Standardize GSTR-3B (self-declared sales and ITC)
    gstr3b_clean = gstr3b_df.select(
        col("return_period").cast("string"),
        col("total_taxable_outward_supplies").cast("double"),
        col("total_itc_claimed").cast("double")
    )

    # Clean Bank Statements for reconciliation
    bank_clean = bank_df.select(
        col("txn_date").cast("date"),
        col("narration"),
        col("withdrawal").cast("double").alias("debit"),
        col("deposit").cast("double").alias("credit")
    ).fillna(0, subset=["debit", "credit"])

    gstr2a_clean.write.format("delta").mode("overwrite").saveAsTable(f"silver.gstr2a_clean_{tenant_id}")
    gstr3b_clean.write.format("delta").mode("overwrite").saveAsTable(f"silver.gstr3b_clean_{tenant_id}")
    bank_clean.write.format("delta").mode("overwrite").saveAsTable(f"silver.bank_clean_{tenant_id}")


# ==============================================================================
# 3. GOLD LAYER: Business Aggregations & Anomaly Detection
# ==============================================================================
def process_gold_layer(tenant_id: str, analysis_id: str):
    """
    Cross-leverage 2A (ITC available) vs 3B (ITC claimed/Sales) vs Bank (Cash flows)
    Identifies 'Circular Trading' and 'Revenue Inflation'.
    """
    gstr2a_clean = spark.table(f"silver.gstr2a_clean_{tenant_id}")
    gstr3b_clean = spark.table(f"silver.gstr3b_clean_{tenant_id}")
    bank_clean = spark.table(f"silver.bank_clean_{tenant_id}")

    # Aggregation 1: GSTR-2A vs 3B ITC Reconciliation
    total_2a_itc = gstr2a_clean.agg(
        sum("igst_amount").alias("tot_igst"),
        sum("cgst_amount").alias("tot_cgst"),
        sum("sgst_amount").alias("tot_sgst")
    ).collect()[0]

    actual_itc_available = (total_2a_itc.tot_igst or 0) + (total_2a_itc.tot_cgst or 0) + (total_2a_itc.tot_sgst or 0)

    # Calculate 3B declared totals
    total_3b = gstr3b_clean.agg(
        sum("total_itc_claimed").alias("itc_claimed"),
        sum("total_taxable_outward_supplies").alias("declared_sales")
    ).collect()[0]

    itc_claimed = total_3b.itc_claimed or 0
    declared_sales = total_3b.declared_sales or 0

    # Risk Flag: ITC Claimed > 2A Available (Overclaiming Input Tax Credit)
    itc_mismatch_ratio = (itc_claimed / actual_itc_available) if actual_itc_available > 0 else float('inf')
    
    # Aggregation 2: Circular Trading Detection
    # Identifies high dependency on a single supplier network without corresponding bank outflows
    supplier_concentration = gstr2a_clean.groupBy("supplier_gstin").agg(
        sum("taxable_value").alias("procurement_value"),
        count("invoice_number").alias("invoice_count")
    ).orderBy(col("procurement_value").desc())

    top_supplier_value = supplier_concentration.limit(1).select("procurement_value").collect()[0][0] or 0
    total_procurement = gstr2a_clean.agg(sum("taxable_value")).collect()[0][0] or 1

    supplier_concentration_ratio = top_supplier_value / total_procurement

    # Aggregation 3: Revenue Inflation (Bank credits vs 3B Sales)
    total_bank_credits = bank_clean.agg(sum("credit")).collect()[0][0] or 0
    
    # Risk Flag: Declared Sales significantly higher than Bank Inflows
    revenue_inflation_flag = (declared_sales > (total_bank_credits * 1.5))
    
    # Create final Feature Vector for the ML Engine
    gold_features = spark.createDataFrame([{
        "analysis_id": analysis_id,
        "tenant_id": tenant_id,
        "gst_declared_sales": float(declared_sales),
        "gst_itc_mismatch_ratio": float(itc_mismatch_ratio),
        "supplier_concentration_ratio": float(supplier_concentration_ratio),
        "revenue_inflation_flag": bool(revenue_inflation_flag),
        "circular_trading_risk": bool(supplier_concentration_ratio > 0.4 and itc_mismatch_ratio > 1.1)
    }])

    # Write to Gold Delta Table serving the API Model Feature Store
    gold_features.write.format("delta").mode("append").saveAsTable("gold.credit_gst_features")
    return gold_features

# Entry point for Databricks Job
if __name__ == "__main__":
    # Example Parameters populated by Databricks Job Runner
    TENANT_ID = "tnt_hdfc_01"
    ANALYSIS_ID = "evt_987654321"

    load_bronze_layer(TENANT_ID, ANALYSIS_ID)
    process_silver_layer(TENANT_ID)
    process_gold_layer(TENANT_ID, ANALYSIS_ID)
