from pydantic import BaseModel, Field, StrictFloat

class FinancialMetrics(BaseModel):
    """
    Strict validation schema for deterministic financial scoring and LLM extraction.
    Enforces StrictFloat to prevent type coercion anomalies during data processing.
    """
    revenue: StrictFloat = Field(..., description="Total operating revenue in exact float format")
    ebitda: StrictFloat = Field(..., description="Earnings Before Interest, Taxes, Depreciation, and Amortization")
    total_debt: StrictFloat = Field(..., description="Total short term and long term debt")
    net_worth: StrictFloat = Field(..., description="Total equity or net worth of the entity")
