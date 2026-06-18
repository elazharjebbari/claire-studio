from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Pagination per CONTRACT §3: ?page=&page_size=."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500


def results_envelope(data) -> dict:
    """Wrap an already-serialized list in the standard paginated envelope
    ``{count, next, previous, results}`` WITHOUT truncation.

    Custom ``@action`` list endpoints (assignments, versions, comments, reviews,
    project translations) are consumed by the frontend as ``Paginated<T>`` —
    returning a bare list makes ``data.results`` undefined and crashes the UI.
    """
    items = list(data)
    return {"count": len(items), "next": None, "previous": None, "results": items}
