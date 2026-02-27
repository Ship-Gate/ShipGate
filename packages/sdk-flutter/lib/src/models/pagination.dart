import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:meta/meta.dart';

part 'pagination.freezed.dart';
part 'pagination.g.dart';

/// Pagination request parameters
@freezed
class PaginationParams with _$PaginationParams {
  const PaginationParams._();

  const factory PaginationParams({
    @Default(1) int page,
    @Default(20) int pageSize,
    String? sortBy,
    @Default(SortOrder.desc) SortOrder sortOrder,
    String? cursor,
  }) = _PaginationParams;

  factory PaginationParams.fromJson(Map<String, dynamic> json) =>
      _$PaginationParamsFromJson(json);

  /// Create cursor-based pagination params
  factory PaginationParams.cursor(String cursor, {int pageSize = 20}) =>
      PaginationParams(cursor: cursor, pageSize: pageSize);

  /// Create offset-based pagination params
  factory PaginationParams.offset(int page, {int pageSize = 20}) =>
      PaginationParams(page: page, pageSize: pageSize);

  Map<String, String> toQueryParams() {
    final params = <String, String>{
      'page': page.toString(),
      'pageSize': pageSize.toString(),
    };
    if (sortBy != null) {
      params['sortBy'] = sortBy!;
      params['sortOrder'] = sortOrder.name;
    }
    if (cursor != null) {
      params['cursor'] = cursor!;
    }
    return params;
  }
}

enum SortOrder {
  @JsonValue('asc')
  asc,
  @JsonValue('desc')
  desc,
}

/// Paginated response wrapper
@freezed
class PaginatedResponse<T> with _$PaginatedResponse<T> {
  const PaginatedResponse._();

  const factory PaginatedResponse({
    required List<T> items,
    required PaginationMeta meta,
  }) = _PaginatedResponse<T>;

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Object?) fromJsonT,
  ) {
    return PaginatedResponse<T>(
      items: (json['items'] as List).map((e) => fromJsonT(e)).toList(),
      meta: PaginationMeta.fromJson(json['meta'] as Map<String, dynamic>),
    );
  }

  bool get hasNextPage => meta.hasNextPage;
  bool get hasPrevPage => meta.hasPrevPage;
  int get totalPages => meta.totalPages;
  int get totalItems => meta.totalItems;

  /// Get params for the next page
  PaginationParams? nextPageParams() {
    if (!hasNextPage) return null;
    if (meta.nextCursor != null) {
      return PaginationParams.cursor(
        meta.nextCursor!,
        pageSize: meta.pageSize,
      );
    }
    return PaginationParams.offset(
      meta.currentPage + 1,
      pageSize: meta.pageSize,
    );
  }

  /// Get params for the previous page
  PaginationParams? prevPageParams() {
    if (!hasPrevPage) return null;
    if (meta.prevCursor != null) {
      return PaginationParams.cursor(
        meta.prevCursor!,
        pageSize: meta.pageSize,
      );
    }
    return PaginationParams.offset(
      meta.currentPage - 1,
      pageSize: meta.pageSize,
    );
  }
}

/// Pagination metadata
@freezed
class PaginationMeta with _$PaginationMeta {
  const PaginationMeta._();

  const factory PaginationMeta({
    required int currentPage,
    required int pageSize,
    required int totalItems,
    required int totalPages,
    required bool hasNextPage,
    required bool hasPrevPage,
    String? nextCursor,
    String? prevCursor,
  }) = _PaginationMeta;

  factory PaginationMeta.fromJson(Map<String, dynamic> json) =>
      _$PaginationMetaFromJson(json);

  factory PaginationMeta.fromResponse({
    required int currentPage,
    required int pageSize,
    required int totalItems,
    String? nextCursor,
    String? prevCursor,
  }) {
    final totalPages = (totalItems / pageSize).ceil();
    return PaginationMeta(
      currentPage: currentPage,
      pageSize: pageSize,
      totalItems: totalItems,
      totalPages: totalPages,
      hasNextPage: nextCursor != null || currentPage < totalPages,
      hasPrevPage: prevCursor != null || currentPage > 1,
      nextCursor: nextCursor,
      prevCursor: prevCursor,
    );
  }
}

/// Extension for easy pagination on lists
extension PaginationExtension<T> on List<T> {
  PaginatedResponse<T> paginate(PaginationParams params, {int? totalItems}) {
    final total = totalItems ?? length;
    final start = (params.page - 1) * params.pageSize;
    final end = start + params.pageSize;

    final items = start < length
        ? sublist(start, end > length ? length : end)
        : <T>[];

    return PaginatedResponse(
      items: items,
      meta: PaginationMeta.fromResponse(
        currentPage: params.page,
        pageSize: params.pageSize,
        totalItems: total,
      ),
    );
  }
}
