"""Article HTML sanitisation.

Allow-list, not deny-list: anything not named here is removed. A deny-list has
to anticipate every dangerous construct browsers will ever parse; an allow-list
only has to describe the formatting a match report actually needs.

nh3 wraps Ammonia, a Rust sanitiser built on a spec-compliant HTML parser. It
replaces bleach, whose maintainers have marked it inactive.
"""

from __future__ import annotations

import nh3

# No h1: the article title is the page's h1, and a second one breaks the
# heading outline screen-reader users navigate by.
ALLOWED_TAGS: frozenset[str] = frozenset(
    {"p", "br", "strong", "em", "a", "ul", "ol", "li", "h2", "h3", "blockquote"}
)

ALLOWED_ATTRIBUTES: dict[str, frozenset[str]] = {"a": frozenset({"href", "title"})}

# javascript:, data: and vbscript: URLs are how an allowed <a> becomes script.
ALLOWED_URL_SCHEMES: frozenset[str] = frozenset({"http", "https", "mailto"})

# Removed together with their content, rather than unwrapped into visible text.
DROPPED_WITH_CONTENT: frozenset[str] = frozenset(
    {"script", "style", "iframe", "object", "embed", "template", "noscript"}
)


def sanitize_html(html: str) -> str:
    return nh3.clean(
        html,
        tags=set(ALLOWED_TAGS),
        clean_content_tags=set(DROPPED_WITH_CONTENT),
        attributes={tag: set(attrs) for tag, attrs in ALLOWED_ATTRIBUTES.items()},
        url_schemes=set(ALLOWED_URL_SCHEMES),
        # noopener stops the linked page reaching back through window.opener;
        # nofollow stops a careless link lending the club's reputation to spam.
        link_rel="noopener noreferrer nofollow",
        strip_comments=True,
    ).strip()
