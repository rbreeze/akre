# Akre Static Website Utility

Akre expects the following directory structure: 

```
.
├── dist
|   ├── This is the build target directory
├── src
│   ├── globals.yaml
│   ├── pages
│   │   └── index (this is an example page directory)
│   │       ├── index.hbs (HBS template)
│   │       └── index.yaml (YAML data injected into template at build)
│   ├── partials
│   │   └── layout.hbs (all files in this folder are available to all pages as partials)
│   ├── static
│   │   └── Anything in this folder is copied to dist/assets
```