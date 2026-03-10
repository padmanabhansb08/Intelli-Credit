import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchPortfolio } from '@/lib/api';

// Custom hook for debouncing input values
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export function useIntelligentSearch({ initialQuery = "", delay = 300, initialFilters = {} } = {}) {
    const [searchTerm, setSearchTerm] = useState(initialQuery);
    const [filters, setFilters] = useState(initialFilters);

    // Explicit 300ms debounce to prevent API spamming
    const debouncedSearchTerm = useDebounce(searchTerm, delay);
    const debouncedFilters = useDebounce(filters, delay);

    const {
        data: results = [],
        isLoading,
        isError,
        error,
        isFetching
    } = useQuery({
        queryKey: ['portfolioSearch', debouncedSearchTerm, debouncedFilters],
        queryFn: () => searchPortfolio({
            q: debouncedSearchTerm,
            ...debouncedFilters,
            limit: 50 // Enforce max limit for dashboard
        }),
        // Retain previous data while fetching new results for smoother UX
        placeholderData: (previousData) => previousData,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    return {
        searchTerm,
        setSearchTerm,
        filters,
        setFilters,
        results,
        isLoading: isLoading || isFetching,
        isError,
        error
    };
}
