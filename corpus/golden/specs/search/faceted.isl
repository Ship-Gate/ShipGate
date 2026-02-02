// Search: Faceted search
domain SearchFaceted {
  version: "1.0.0"

  type Facet = {
    name: String
    field: String
    values: List<{
      value: String
      count: Int
      selected: Boolean
    }>
  }

  type FacetFilter = {
    field: String
    values: List<String>
    operator: String?
  }

  type PriceRange = {
    min: Decimal
    max: Decimal
    count: Int
  }

  behavior FacetedSearch {
    description: "Search with faceted navigation"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      query: String?
      category: String?
      facet_filters: List<FacetFilter>?
      price_min: Decimal?
      price_max: Decimal?
      in_stock_only: Boolean?
      facets_to_return: List<String>?
      page: Int?
      page_size: Int?
      sort_by: String?
    }

    output {
      success: {
        results: List<{
          id: UUID
          name: String
          price: Decimal
          category: String
          attributes: Map<String, String>
        }>
        facets: List<Facet>
        price_ranges: List<PriceRange>
        total_count: Int
        page: Int
        has_more: Boolean
      }
    }

    pre {
      input.page == null or input.page >= 1
      input.page_size == null or (input.page_size >= 1 and input.page_size <= 100)
      input.price_min == null or input.price_min >= 0
      input.price_max == null or input.price_max >= 0
      input.price_min == null or input.price_max == null or input.price_max >= input.price_min
    }

    post success {
      - result.facets.length > 0 or input.facets_to_return.length == 0
    }

    temporal {
      - within 300ms (p99): response returned
    }
  }

  behavior GetFacets {
    description: "Get available facets"

    actors {
      Anonymous { }
    }

    input {
      category: String?
      query: String?
    }

    output {
      success: List<{
        field: String
        name: String
        type: String
        values: List<{ value: String, count: Int }>
      }>
    }
  }

  behavior GetPriceDistribution {
    description: "Get price distribution"

    actors {
      Anonymous { }
    }

    input {
      category: String?
      facet_filters: List<FacetFilter>?
      bucket_count: Int?
    }

    output {
      success: {
        min_price: Decimal
        max_price: Decimal
        avg_price: Decimal
        buckets: List<PriceRange>
      }
    }

    pre {
      input.bucket_count == null or (input.bucket_count >= 1 and input.bucket_count <= 20)
    }
  }

  behavior GetCategoryFacets {
    description: "Get facets for a category"

    actors {
      Anonymous { }
    }

    input {
      category_id: UUID
    }

    output {
      success: List<{
        field: String
        name: String
        type: String
        filterable: Boolean
        sortable: Boolean
      }>

      errors {
        CATEGORY_NOT_FOUND {
          when: "Category not found"
          retriable: false
        }
      }
    }
  }

  scenarios FacetedSearch {
    scenario "search with facets" {
      when {
        result = FacetedSearch(
          query: "laptop",
          facet_filters: [
            { field: "brand", values: ["Apple", "Dell"] },
            { field: "ram", values: ["16GB", "32GB"] }
          ],
          price_min: 500,
          price_max: 2000,
          facets_to_return: ["brand", "ram", "storage", "screen_size"]
        )
      }

      then {
        result is success
        result.facets.length >= 4
      }
    }

    scenario "category browse" {
      when {
        result = FacetedSearch(
          category: "electronics/phones",
          in_stock_only: true,
          sort_by: "price_asc"
        )
      }

      then {
        result is success
      }
    }
  }
}
