from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Pagination per CONTRACT §3: ?page=&page_size=."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500
