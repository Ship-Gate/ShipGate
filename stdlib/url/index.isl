# URL Standard Library Module
# Provides URL parsing and manipulation operations
#
# DETERMINISM NOTE:
# All functions in this module are DETERMINISTIC

module URL version "1.0.0"

# ============================================
# Types
# ============================================

type URLString = String {
  description: "Valid URL string"
  max_length: 2048
}

type Protocol = String {
  pattern: "^[a-z][a-z0-9+.-]*$"
  description: "URL protocol/scheme (e.g., http, https, ftp)"
}

type Host = String {
  max_length: 253
  description: "URL hostname"
}

type Port = Int {
  min: 1
  max: 65535
  description: "Port number"
}

type Path = String {
  description: "URL path component"
}

type QueryString = String {
  description: "URL query string (without leading ?)"
}

type Fragment = String {
  description: "URL fragment/hash (without leading #)"
}

# ============================================
# Entities
# ============================================

entity ParsedURL {
  href: URLString              # Full URL
  protocol: Protocol           # e.g., "https"
  host: Host                   # e.g., "example.com:8080"
  hostname: Host               # e.g., "example.com"
  port: Port?                  # e.g., 8080
  pathname: Path               # e.g., "/path/to/resource"
  search: QueryString?         # e.g., "?key=value" (with ?)
  query: QueryString?          # e.g., "key=value" (without ?)
  hash: Fragment?              # e.g., "#section" (with #)
  fragment: Fragment?          # e.g., "section" (without #)
  origin: String               # e.g., "https://example.com:8080"
  username: String?
  password: String?
  
  invariants {
    host.length > 0
    pathname.starts_with("/") or pathname == ""
  }
}

entity URLComponents {
  protocol: Protocol?
  username: String?
  password: String?
  hostname: Host?
  port: Port?
  pathname: Path?
  query: Map<String, String | List<String>>?
  fragment: Fragment?
}

entity QueryParams {
  params: Map<String, String | List<String>>
  
  invariants {
    # Keys are non-empty strings
  }
}

entity URLParseResult {
  success: Boolean
  url: ParsedURL?
  error_message: String?
  
  invariants {
    success implies url != null
    not success implies error_message != null
  }
}

# ============================================
# Behaviors - Parsing
# ============================================

behavior Parse {
  description: "Parse URL string into components (DETERMINISTIC)"
  deterministic: true

  input {
    url: String
    base: URLString?
  }

  output {
    success: ParsedURL

    errors {
      INVALID_URL {
        when: "URL string is malformed"
        retriable: false
      }
      INVALID_PROTOCOL {
        when: "URL protocol is not recognized"
        retriable: false
      }
      INVALID_HOST {
        when: "URL host is invalid"
        retriable: false
      }
    }
  }

  pre {
    url.length > 0
  }

  post success {
    result.href.length > 0
    result.protocol.length > 0
    result.host.length > 0
  }
}

behavior TryParse {
  description: "Try to parse URL, returning result object (DETERMINISTIC)"
  deterministic: true

  input {
    url: String
    base: URLString?
  }

  output {
    success: URLParseResult
  }

  post success {
    # Never throws, always returns result
  }
}

behavior ParseQuery {
  description: "Parse query string into parameters (DETERMINISTIC)"
  deterministic: true

  input {
    query: QueryString
    decode: Boolean [default: true]
  }

  output {
    success: QueryParams
  }
}

# ============================================
# Behaviors - Component Access
# ============================================

behavior GetProtocol {
  description: "Get URL protocol (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: Protocol

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior GetHost {
  description: "Get URL host (hostname:port) (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: String

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior GetHostname {
  description: "Get URL hostname (without port) (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: Host

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior GetPort {
  description: "Get URL port (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: Port?

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior GetPathname {
  description: "Get URL pathname (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: Path

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    result.starts_with("/") or result == ""
  }
}

behavior GetSearch {
  description: "Get URL search/query string with ? (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: String?

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    result == null or result.starts_with("?")
  }
}

behavior GetHash {
  description: "Get URL hash/fragment with # (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: String?

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    result == null or result.starts_with("#")
  }
}

behavior GetOrigin {
  description: "Get URL origin (protocol + host) (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: String

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

# ============================================
# Behaviors - Query Parameters
# ============================================

behavior GetQueryParam {
  description: "Get single query parameter value (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    name: String
    default_value: String?
  }

  output {
    success: String?

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior GetQueryParams {
  description: "Get all query parameters (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: QueryParams

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior GetQueryParamAll {
  description: "Get all values for a query parameter (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    name: String
  }

  output {
    success: List<String>

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior HasQueryParam {
  description: "Check if query parameter exists (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    name: String
  }

  output {
    success: Boolean

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior SetQueryParam {
  description: "Set query parameter value (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    name: String
    value: String
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    HasQueryParam(result, input.name) == true
  }
}

behavior SetQueryParams {
  description: "Set multiple query parameters (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    params: Map<String, String>
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior RemoveQueryParam {
  description: "Remove query parameter (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    name: String
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    HasQueryParam(result, input.name) == false
  }
}

behavior ClearQueryParams {
  description: "Remove all query parameters (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    GetSearch(result) == null or GetSearch(result) == ""
  }
}

# ============================================
# Behaviors - Building URLs
# ============================================

behavior Build {
  description: "Build URL from components (DETERMINISTIC)"
  deterministic: true

  input {
    components: URLComponents
  }

  output {
    success: URLString

    errors {
      MISSING_HOSTNAME {
        when: "Hostname is required but not provided"
        retriable: false
      }
      MISSING_PROTOCOL {
        when: "Protocol is required but not provided"
        retriable: false
      }
    }
  }

  pre {
    components.hostname != null
    components.protocol != null
  }
}

behavior BuildQuery {
  description: "Build query string from parameters (DETERMINISTIC)"
  deterministic: true

  input {
    params: Map<String, String | List<String>>
    encode: Boolean [default: true]
  }

  output {
    success: QueryString
  }
}

behavior Join {
  description: "Join URL with path segments (DETERMINISTIC)"
  deterministic: true

  input {
    base: URLString
    segments: List<String>
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "Base URL is malformed"
        retriable: false
      }
    }
  }
}

behavior Resolve {
  description: "Resolve relative URL against base (DETERMINISTIC)"
  deterministic: true

  input {
    base: URLString
    relative: String
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "Base URL is malformed"
        retriable: false
      }
    }
  }
}

# ============================================
# Behaviors - Validation
# ============================================

behavior IsValid {
  description: "Check if string is a valid URL (DETERMINISTIC)"
  deterministic: true

  input {
    url: String
  }

  output {
    success: Boolean
  }
}

behavior IsAbsolute {
  description: "Check if URL is absolute (DETERMINISTIC)"
  deterministic: true

  input {
    url: String
  }

  output {
    success: Boolean
  }

  post success {
    result implies url.matches("^[a-z][a-z0-9+.-]*://")
  }
}

behavior IsRelative {
  description: "Check if URL is relative (DETERMINISTIC)"
  deterministic: true

  input {
    url: String
  }

  output {
    success: Boolean
  }

  post success {
    result == not IsAbsolute(input.url)
  }
}

behavior IsHttps {
  description: "Check if URL uses HTTPS (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: Boolean

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    result == GetProtocol(input.url).toLowerCase() == "https"
  }
}

behavior IsSameOrigin {
  description: "Check if two URLs have same origin (DETERMINISTIC)"
  deterministic: true

  input {
    url1: URLString
    url2: URLString
  }

  output {
    success: Boolean

    errors {
      INVALID_URL {
        when: "One or both URLs are malformed"
        retriable: false
      }
    }
  }

  post success {
    result == (GetOrigin(input.url1) == GetOrigin(input.url2))
  }
}

# ============================================
# Behaviors - Normalization
# ============================================

behavior Normalize {
  description: "Normalize URL (lowercase scheme/host, remove default port, etc.) (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    options: {
      lowercase_scheme: Boolean [default: true]
      lowercase_host: Boolean [default: true]
      remove_default_port: Boolean [default: true]
      remove_trailing_slash: Boolean [default: false]
      sort_query_params: Boolean [default: false]
      remove_empty_query_params: Boolean [default: false]
    }?
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior RemoveTrailingSlash {
  description: "Remove trailing slash from pathname (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    GetPathname(result) == "/" or not GetPathname(result).ends_with("/")
  }
}

behavior AddTrailingSlash {
  description: "Add trailing slash to pathname (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    GetPathname(result).ends_with("/")
  }
}

# ============================================
# Behaviors - Modification
# ============================================

behavior SetProtocol {
  description: "Set URL protocol (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    protocol: Protocol
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    GetProtocol(result) == input.protocol
  }
}

behavior SetHost {
  description: "Set URL host (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    host: Host
    port: Port?
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior SetPathname {
  description: "Set URL pathname (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    pathname: Path
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    GetPathname(result) == input.pathname or GetPathname(result) == "/" + input.pathname
  }
}

behavior SetHash {
  description: "Set URL hash/fragment (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
    hash: Fragment?
  }

  output {
    success: URLString

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

# ============================================
# Behaviors - Path Utilities
# ============================================

behavior GetPathSegments {
  description: "Get pathname as array of segments (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: List<String>

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior GetFilename {
  description: "Get filename from pathname (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: String?

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }
}

behavior GetExtension {
  description: "Get file extension from pathname (DETERMINISTIC)"
  deterministic: true

  input {
    url: URLString
  }

  output {
    success: String?

    errors {
      INVALID_URL {
        when: "URL is malformed"
        retriable: false
      }
    }
  }

  post success {
    result == null or result.starts_with(".")
  }
}

# ============================================
# Constants
# ============================================

const DEFAULT_HTTP_PORT: Port = 80
const DEFAULT_HTTPS_PORT: Port = 443
const DEFAULT_FTP_PORT: Port = 21
const DEFAULT_WS_PORT: Port = 80
const DEFAULT_WSS_PORT: Port = 443

const PROTOCOL_HTTP: Protocol = "http"
const PROTOCOL_HTTPS: Protocol = "https"
const PROTOCOL_FTP: Protocol = "ftp"
const PROTOCOL_WS: Protocol = "ws"
const PROTOCOL_WSS: Protocol = "wss"
const PROTOCOL_FILE: Protocol = "file"
const PROTOCOL_DATA: Protocol = "data"
