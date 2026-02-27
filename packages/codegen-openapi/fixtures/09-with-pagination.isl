// Domain with pagination and list behaviors
domain Pagination {
  version: "1.0.0"
  
  type PaginatedResult = {
    items: List<Article>
    total: Int
    page: Int
    page_size: Int
    has_next: Boolean
    has_prev: Boolean
  }
  
  enum ArticleStatus {
    DRAFT
    PUBLISHED
    ARCHIVED
  }
  
  entity Article {
    id: UUID [immutable]
    title: String
    content: String
    author_id: UUID
    status: ArticleStatus
    view_count: Int
    published_at: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  behavior ListArticles {
    description: "List articles with pagination"
    input {
      page: Int?
      page_size: Int?
      status: ArticleStatus?
      author_id: UUID?
      search: String?
      sort_by: String?
      sort_order: String?
    }
    output {
      success: PaginatedResult
    }
  }
  
  behavior GetArticle {
    input {
      id: UUID
    }
    output {
      success: Article
      errors {
        ARTICLE_NOT_FOUND {
          when: "Article does not exist"
        }
      }
    }
  }
  
  behavior CreateArticle {
    input {
      title: String
      content: String
      status: ArticleStatus?
    }
    output {
      success: Article
    }
  }
  
  behavior SearchArticles {
    description: "Full-text search articles"
    input {
      query: String
      page: Int?
      page_size: Int?
    }
    output {
      success: PaginatedResult
    }
  }
}
