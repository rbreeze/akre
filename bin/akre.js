#!/usr/bin/env node

const fs = require("fs");
const shell = require("child_process").execSync;
const path = require("path");
const yaml = require("js-yaml");
const Handlebars = require("handlebars");
const chokidar = require("chokidar");
const handler = require("serve-handler");
const http = require("http");
const { exit } = require("process");

const postcss = require("postcss");

const _GREEN = "\x1b[32m";
const _RED = "\x1b[31m";
const _RESET = "\x1b[0m";
const logger = {
  error: (s) => console.log(`${_RED}[ERROR]${_RESET} ${s}`),
  info: (s) => console.log(`${_GREEN}[INFO]${_RESET} ${s}`),
};

const args = process.argv.slice(2);

const TEMPLATE_EXT = ".hbs";
const DATA_EXT = ".yaml";
const PORT = 3000;

// Input
const SOURCE = "./src";
const PAGES_PATH = `${SOURCE}/pages`;
const PARTIALS_PATH = `${SOURCE}/partials`;
const STATIC_PATH = `${SOURCE}/static`;
const GLOBALS_PATH = `${SOURCE}/globals${DATA_EXT}`;
const STYLES_PATH = `${SOURCE}/styles/main.css`;

// Output
const BUILD_TARGET = "./dist";
const ASSETS_TARGET = `${BUILD_TARGET}/assets`;
const STYLES_TARGET = `${ASSETS_TARGET}/css/main.css`;

const tailwindcss = require("tailwindcss")({
  mode: "jit",
  purge: [`${PAGES_PATH}/**/*`],
});

const build = () => {
  const start = Date.now();
  try {
    fs.mkdirSync(ASSETS_TARGET, { recursive: true });
  } catch (e) {
    logger.error(`Could not create target directory: ${e}`);
  }

  Handlebars.registerHelper("breaklines", (text) => {
    text = Handlebars.Utils.escapeExpression(text);
    text = text.replace(/(\r\n|\n|\r)/gm, "<br>");
    return new Handlebars.SafeString(text);
  });

  let partials = [];
  try {
    partials = fs.readdirSync(PARTIALS_PATH);
  } catch (e) {
    logger.error(e);
  }

  for (const file of partials) {
    if (path.extname(file) !== TEMPLATE_EXT) {
      logger.info(
        `Partials directory contains non ${TEMPLATE_EXT} file: ${file}`
      );
      continue;
    }

    Handlebars.registerPartial(
      path.parse(file).name,
      fs.readFileSync(`${PARTIALS_PATH}/${file}`).toString()
    );
  }

  let globals = {};
  try {
    globals = yaml.load(fs.readFileSync(GLOBALS_PATH).toString());
  } catch (e) {
    logger.error(`Could not load globals: ${e}`);
  }

  let pages = [];
  try {
    pages = fs.readdirSync(PAGES_PATH);
  } catch (e) {
    logger.error(e);
    exit(1);
  }

  for (const page of pages) {
    const pathFor = (page, ext) => `${PAGES_PATH}/${page}/${page}${ext}`;
    const readExt = (ext) => fs.readFileSync(pathFor(page, ext));
    const extExists = (ext) => fs.existsSync(pathFor(page, ext));

    if (!extExists(DATA_EXT)) {
      logger.error(`Data file not found for page ${page}`);
      continue;
    } else if (!extExists(TEMPLATE_EXT)) {
      logger.error(`Template file not found for page ${page}`);
      continue;
    }

    let parsed = {};
    try {
      parsed = yaml.load(readExt(DATA_EXT).toString());
    } catch (e) {
      logger.error(`Could not parse data file ${page}${DATA_EXT}: ${e}`);
    }

    try {
      const template = Handlebars.compile(readExt(TEMPLATE_EXT).toString());
      const p = page === "index" ? "index.html" : page;
      fs.writeFileSync(
        `${BUILD_TARGET}/${p}`,
        template({
          ...parsed,
          globals,
        })
      );
    } catch (e) {
      logger.error(`Could not render template ${page}${TEMPLATE_EXT}: ${e}`);
    }
  }

  const css = fs.readFileSync(STYLES_PATH);
  postcss([require("autoprefixer"), require("postcss-import"), tailwindcss])
    .process(css, { from: STYLES_PATH, to: STYLES_TARGET })
    .then((result) => {
      fs.writeFileSync(STYLES_TARGET, result.css);
    });

  shell(`cp -r ${STATIC_PATH}/* ${ASSETS_TARGET}`);
  logger.info(`build executed in ${Date.now() - start}ms`);
};

const watch = () => {
  build();
  http
    .createServer((req, res) => handler(req, res, { public: BUILD_TARGET }))
    .listen(PORT, () => {
      logger.info(`Server running at http://localhost:${PORT}`);
    });

  chokidar.watch("./src").on("change", (event) => {
    build();
    logger.info(`${event}`);
  });
};

const commands = {
  watch: watch,
  build: build,
};

let selected = null;
for (const command of Object.keys(commands)) {
  if (args[0] === command) {
    selected = commands[command];
  }
}

if (!selected) {
  logger.error(
    "Incorrect usage: please use a command from the following options:"
  );
  logger.info(Object.keys(commands));
} else {
  selected();
}
