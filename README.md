# Akre Static Website Utility

- the `init` command will construct a `src` directory that contains `pages`, `partials`, `style`, and `static` directories, as well as a `globals.yaml` file for global data. It will also generate a `pages/index` directory with necessary files for an index page.
- Only `styles/main.scss` is compiled. Use `@include` in main.scss to include other global SCSS files.