# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parse, tryParse, parseQuery, getProtocol, getHost, getHostname, getPort, getPathname, getSearch, getHash, getOrigin, getQueryParam, getQueryParams, getQueryParamAll, hasQueryParam, setQueryParam, setQueryParams, removeQueryParam, clearQueryParams, build, buildQuery, join, resolve, isValid, isAbsolute, isRelative, isHttps, isSameOrigin, normalize, removeTrailingSlash, addTrailingSlash, setProtocol, setHost, setPathname, setHash, getPathSegments, getFilename, getExtension, DEFAULT_HTTP_PORT, DEFAULT_HTTPS_PORT, DEFAULT_FTP_PORT, DEFAULT_WS_PORT, DEFAULT_WSS_PORT, PROTOCOL_HTTP, PROTOCOL_HTTPS, PROTOCOL_FTP, PROTOCOL_WS, PROTOCOL_WSS, PROTOCOL_FILE, PROTOCOL_DATA, URL_, ParsedURL, URLComponents, QueryParams, URLParseResult
# dependencies: 

domain Url {
  version: "1.0.0"

  type ParsedURL = String
  type URLComponents = String
  type QueryParams = String
  type URLParseResult = String

  invariants exports_present {
    - true
  }
}
