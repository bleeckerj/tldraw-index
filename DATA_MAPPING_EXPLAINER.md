# Data Mapping Explainer: Astro to `cards.json`

This document outlines the schema requirements for generating the `cards.json` file used by the tldraw-index application. This file serves as the data source for the interactive card interface.

## Objective

Create a build script in the Astro project that aggregates items from specified Content Collections and outputs a single JSON file matching the schema below.

## Target Schema (`cards.json`)

The output must be a flat JSON array of objects.

### Field Reference

| Field | Type | Required | Description | Astro Mapping Suggestion |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Unique identifier for the card. | Use `entry.slug` or a combination of `collection` + `slug`. |
| `title` | `string` | **Yes** | The display title. | `entry.data.title` |
| `summary` | `string` | **Yes** | Short description text. | `entry.data.description` or a truncated excerpt. |
| `collection` | `string` | **Yes** | The source group name. | The name of the content collection (e.g., `'blog'`, `'projects'`). |
| `tags` | `string[]` | **Yes** | Array of filterable tags. | `entry.data.tags` (ensure it defaults to `[]` if empty). |
| `image` | `string` | **Yes** | URL to the featured image. | `entry.data.heroImage` or `entry.data.cover`. Must be a resolved absolute URL or public path. |
| `url` | `string` | **Yes** | Link to the full content page. | The calculated permalink (e.g., `/blog/${entry.slug}`). |
| `date` | `string` | **Yes** | Publication or relevant date. | `entry.data.pubDate` (formatted as ISO string). |

## Example Output

```json
[
  {
    "id": "posters/dune-2024",
    "title": "Dune Poster",
    "summary": "Poster art sample from a content collection.",
    "collection": "posters",
    "tags": ["sci-fi", "art", "design"],
    "image": "https://example.com/images/dune-poster.webp",
    "url": "https://example.com/posters/dune-2024",
    "date": "2024-03-01"
  },
  {
    "id": "blog/my-first-post",
    "title": "Hello World",
    "summary": "An introduction to the new static site.",
    "collection": "blog",
    "tags": ["update"],
    "image": "/assets/blog/hello-world.jpg",
    "url": "/blog/my-first-post",
    "date": "2024-01-15"
  }
]
```

## Implementation Notes for Astro Build Script

1.  **Image Resolution**: Ensure image paths are accessible from the tldraw application. If the tldraw app is hosted separately, use absolute URLs (e.g., `https://mysite.com/image.jpg`). If hosted on the same domain, relative paths (`/assets/...`) may work.
2.  **Content Collections**: You will likely use `getCollection()` for each desired collection type, map them to this structure, and then flatten the arrays into one list.
3.  **Validation**: Ensure no fields are `undefined`. Provide fallback strings (e.g., empty string `""`) for optional data like `summary` if the source is missing it, although the schema marks them as required.

## Schema Validation

The strict schema definition can be found in `src/data/cards.schema.json`.
