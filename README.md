# Kuleshov Group Blog

The source for the Kuleshov Group's blog, built with [Jekyll](https://jekyllrb.com/) and the [al-folio](https://github.com/alshedivat/al-folio) theme. Published via GitHub Pages.

## Writing a new post

Add a new file to `_posts/` named `YYYY-MM-DD-title.md` with front matter like:

```yaml
---
layout: distill
title: "Your Post Title"
description: "A one- or two-sentence summary shown under the title and in link previews."
date: YYYY-MM-DD

authors:
  - name: Your Name
    url: "https://your-homepage/"
    affiliations:
      name: Cornell University
      url: "https://www.cs.cornell.edu/"

bibliography: your-bib-file.bib

toc:
  - name: "Section Name"
    subsections:
      - name: "Subsection Name"
---
```

Body content supports Markdown as well as Distill web components: `<d-cite key="...">`, `<d-footnote>`, `<figure>`/`<figcaption>`, `<aside>`, `<details>`, and inline/display math with `$...$` / `$$...$$`. Put images in `assets/img/` and BibTeX files in `assets/bibliography/`.

## Local development

Requires Ruby, Bundler, Node, and ImageMagick (`convert`).

```bash
bundle install
bundle exec jekyll serve
```

Then open http://127.0.0.1:4000/.

## Deployment

Pushes to `main` are built and deployed to GitHub Pages automatically via `.github/workflows/deploy.yml`.
