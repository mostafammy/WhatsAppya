"""
Rich Link Extraction and Preview Metadata Engine.
Parses URLs into Apple News / Safari Reading List style visual cards.
"""

import re
from urllib.parse import urlparse
from typing import List, Dict, Optional
from html import escape


class RichLinkExtractor:
    """Extracts and enriches URLs within message text."""

    URL_PATTERN = re.compile(r'(https?://[^\s<>"{}|\\^`\[\]]+)')

    CATEGORY_ICONS = {
        'video': '🎬',
        'code': '💻',
        'social': '💬',
        'news': '📰',
        'portal': '🌐',
        'secure': '🔒',
    }

    @classmethod
    def extract_urls(cls, text: str) -> List[Dict[str, str]]:
        """Extract structured link metadata from raw text."""
        urls = cls.URL_PATTERN.findall(text)
        cards = []
        for raw_url in urls:
            parsed = urlparse(raw_url)
            domain = parsed.netloc.lower()
            if domain.startswith('www.'):
                domain = domain[4:]

            category = cls._categorize_domain(domain)
            icon = cls.CATEGORY_ICONS.get(category, '🌐')

            path_snippet = parsed.path.strip('/')
            title = domain
            if path_snippet:
                parts = path_snippet.split('/')
                title = f"{domain} › {parts[0][:24]}"

            cards.append({
                'raw_url': raw_url,
                'domain': domain,
                'title': title,
                'category': category,
                'icon': icon,
                'is_secure': parsed.scheme == 'https'
            })
        return cards

    @classmethod
    def format_inline_links(cls, text: str) -> str:
        """Convert raw URLs into accessible clickable links."""
        def _replace(match):
            url = match.group(1)
            escaped_url = escape(url)
            return f'<a href="{escaped_url}" target="_blank" rel="noopener noreferrer" class="chat-link">{escaped_url}</a>'
        return cls.URL_PATTERN.sub(_replace, escape(text))

    @classmethod
    def _categorize_domain(cls, domain: str) -> str:
        if any(v in domain for v in ['youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com']):
            return 'video'
        if any(c in domain for c in ['github.com', 'gitlab.com', 'stackoverflow.com']):
            return 'code'
        if any(s in domain for s in ['twitter.com', 'x.com', 'instagram.com', 'facebook.com', 'linkedin.com', 'reddit.com']):
            return 'social'
        if any(n in domain for n in ['wikipedia.org', 'medium.com', 'nytimes.com', 'bbc.com', 'reuters.com']):
            return 'news'
        return 'portal'
