#!/usr/bin/env node

const pino = require("pino");
const fs = require("fs");
const ncp = require("ncp");
const path = require("path");
const yaml = require("js-yaml");
const sass = require("sass");
const Handlebars = require("handlebars");
const chokidar = require("chokidar");
const handler = require("serve-handler");
const http = require("http");
const { exit } = require("process");

const logger = pino({ prettyPrint: { colorize: true } });
const args = process.argv.slice(2);

const stripExtension = (filename) => path.parse(filename).name;

const TEMPLATE_EXT = ".hbs";
const DATA_EXT = ".yaml";
const PORT = 3000;

// Input
const SOURCE = "./src";
const PAGES_PATH = `${SOURCE}/pages`;
const PARTIALS_PATH = `${SOURCE}/partials`;
const STYLES_PATH = `${SOURCE}/style`;
const STATIC_PATH = `${SOURCE}/static`;
const GLOBALS_PATH = `${SOURCE}/globals${DATA_EXT}`;

// Output
const BUILD_TARGET = "./dist";
const ASSETS_TARGET = `${BUILD_TARGET}/assets`;
const STYLES_TARGET = `${ASSETS_TARGET}/css`;
const MAIN_STYLE = "main";

const build = () => {
  const start = Date.now();
  try {
    fs.mkdirSync(STYLES_TARGET, { recursive: true });
  } catch (e) {
    logger.error(`Could not create target directory: ${e}`);
  }

  Handlebars.registerHelper("breaklines", (text) => {
    text = Handlebars.Utils.escapeExpression(text);
    text = text.replace(/(\r\n|\n|\r)/gm, "<br>");
    return new Handlebars.SafeString(text);
  });

  for (const file of fs.readdirSync(PARTIALS_PATH)) {
    if (path.extname(file) !== TEMPLATE_EXT) {
      logger.info(
        `Partials directory contains non ${TEMPLATE_EXT} file: ${file}`
      );
      continue;
    }

    Handlebars.registerPartial(
      stripExtension(file),
      fs.readFileSync(`${PARTIALS_PATH}/${file}`).toString()
    );
  }

  let globals = {};
  try {
    globals = yaml.load(fs.readFileSync(GLOBALS_PATH).toString());
  } catch (e) {
    logger.error(`Could not load globals: ${e}`);
  }

  fs.writeFileSync(
    `${STYLES_TARGET}/${MAIN_STYLE}.css`,
    sass.renderSync({ file: `${STYLES_PATH}/${MAIN_STYLE}.scss` }).css
  );

  for (const page of fs.readdirSync(PAGES_PATH)) {
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

    const stylesheets = [
      path.relative(BUILD_TARGET, `${STYLES_TARGET}/${MAIN_STYLE}.css`),
    ];
    try {
      const result = sass.renderSync({ file: pathFor(page, ".scss") });
      fs.writeFileSync(`${STYLES_TARGET}/${page}.css`, result.css);
    } finally {
      stylesheets.push(
        path.relative(BUILD_TARGET, `${STYLES_TARGET}/${page}.css`)
      );
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
        template({ ...parsed, globals, stylesheets })
      );
    } catch (e) {
      logger.error(`Could not render template ${page}${TEMPLATE_EXT}: ${e}`);
    }
  }

  ncp(STATIC_PATH, ASSETS_TARGET, () => null);

  const end = Date.now();
  logger.info(`build executed in ${end - start}ms`);
};

const watch = () => {
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

const newPage = (name) => {
  fs.mkdirSync(`${PAGES_PATH}/${name}`, { recursive: true });

  const nf = (exts) =>
    exts.forEach((ext) =>
      fs.writeFileSync(`${PAGES_PATH}/${name}/${name}${ext}`, "")
    );

  nf([".scss", TEMPLATE_EXT, DATA_EXT]);
};

const commands = {
  watch: watch,
  build: build,
  new: () => {
    try {
      newPage(args[1]),
        logger.info(`Successfully created directory for page ${args[1]}`);
    } catch (e) {
      logger.error(e);
    }
  },
  init: () => {
    try {
      [PAGES_PATH, PARTIALS_PATH, STYLES_PATH, STATIC_PATH].forEach((p) =>
        fs.mkdirSync(p, { recursive: true })
      );
      newPage("index");
      fs.writeFileSync(GLOBALS_PATH, "");
      logger.info("Successfully initialized Akre structure");
    } catch (e) {
      logger.error(e);
    }
  },
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
