from __future__ import annotations

from typing import Dict


class ImageDescriptionPrompts:
    """Collection of prompts for image description generation."""

    @staticmethod
    def get_base_prompt() -> str:
        """Get the base prompt for image description."""
        return """Analyze this image and provide a concise, descriptive alt text (maximum 150 characters).

Requirements:
- Focus on key visual elements and data
- Use terminology that matches the document context
- Avoid generic phrases like "image shows" or "picture of"
- Be specific about charts, diagrams, or data if present
- Make it searchable and informative"""

    @staticmethod
    def get_chart_specific_prompt() -> str:
        """Get prompt optimized for charts and graphs."""
        return """Analyze this chart/graph and provide a descriptive alt text (maximum 150 characters).

Focus on:
- Type of chart (bar, line, pie, etc.)
- Key data trends or patterns
- Specific values if clearly visible
- Time periods or categories shown
- Main insights or conclusions

Example: "Q4 revenue bar chart showing 25% growth, peak at $2.5M in December" """

    @staticmethod
    def get_diagram_specific_prompt() -> str:
        """Get prompt optimized for diagrams and flowcharts."""
        return """Analyze this diagram and provide a descriptive alt text (maximum 150 characters).

Focus on:
- Type of diagram (flowchart, architecture, process, etc.)
- Main components or elements
- Relationships between parts
- Overall purpose or function

Example: "System architecture diagram showing microservices with API gateway and database" """

    @staticmethod
    def get_table_specific_prompt() -> str:
        """Get prompt optimized for tables."""
        return """Analyze this table and provide a descriptive alt text (maximum 150 characters).

Focus on:
- Number of rows/columns
- Main categories or headers
- Key data points or patterns
- Purpose of the data

Example: "Financial comparison table: 5 companies, revenue and profit margins 2023" """

    @staticmethod
    def get_contextual_prompt(context: Dict) -> str:
        """Build context-aware prompt based on document context."""

        base_prompt = ImageDescriptionPrompts.get_base_prompt()

        # Detect content type and use appropriate prompt
        if context.get('current_section'):
            section = context['current_section'].lower()
            if any(keyword in section for keyword in ['chart', 'graph', 'data', 'revenue', 'profit']):
                base_prompt = ImageDescriptionPrompts.get_chart_specific_prompt()
            elif any(keyword in section for keyword in ['diagram', 'flow', 'process', 'architecture']):
                base_prompt = ImageDescriptionPrompts.get_diagram_specific_prompt()
            elif any(keyword in section for keyword in ['table']):
                base_prompt = ImageDescriptionPrompts.get_table_specific_prompt()

        # Add context information to prompt
        context_parts = []

        if context.get('document_name'):
            context_parts.append(f"Document: {context['document_name']}")

        if context.get('current_section'):
            context_parts.append(f"Section: {context['current_section']}")

        if context.get('preceding_text'):
            preceding = context['preceding_text'][:200] + '...' if len(
                context['preceding_text'],
            ) > 200 else context['preceding_text']
            context_parts.append(f"Preceding text: {preceding}")

        if context.get('following_text'):
            following = context['following_text'][:200] + '...' if len(
                context['following_text'],
            ) > 200 else context['following_text']
            context_parts.append(f"Following text: {following}")

        if context_parts:
            context_str = '\n'.join(context_parts)
            return f"Context:\n{context_str}\n\n{base_prompt}"

        return base_prompt

    @staticmethod
    def get_fallback_prompt() -> str:
        """Get prompt for fallback scenarios."""
        return 'Provide a brief, descriptive alt text for this image in under 100 characters.'
