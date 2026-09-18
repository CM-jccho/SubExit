const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const postcss = require("postcss");
const root = path.resolve(__dirname, "..");
const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
const sheets = [...layout.matchAll(/import "\.\/(.*?\.css)"/g)].map((m) =>
  postcss.parse(fs.readFileSync(path.join(root, "app", m[1]), "utf8")),
);

test("mobile primary navigation has one grid owner and no obsolete five/six-column override", () => {
  const grids = [];
  for (const sheet of sheets)
    sheet.walkRules((rule) => {
      if (rule.selector !== ".dc-nav") return;
      rule.walkDecls("grid-template-columns", (d) => grids.push(d));
    });
  assert.equal(grids.length, 1);
  assert.equal(grids[0].value, "repeat(3, minmax(0, 1fr))");
  assert.ok(!grids[0].important);
  assert.equal(grids[0].parent.parent.params, "(max-width: 700px)");
});

test("live input notice reserves space beyond the raised button and is linked to its control", () => {
  let margin;
  for (const sheet of sheets)
    sheet.walkRules((rule) => {
      if (rule.selector === ".purpose-home .purpose-limit") {
        rule.walkDecls("margin", (d) => {
          margin = parseFloat(d.value);
        });
      }
    });
  assert.ok(
    margin >= 16,
    "scoped notice margin must clear the raised button shadow",
  );
  const home = fs.readFileSync(
    path.join(root, "components/HomeActions.tsx"),
    "utf8",
  );
  assert.match(home, /aria-describedby="live-input-limit"/);
  assert.match(home, /className="purpose-limit[^"]*" id="live-input-limit"/);
});
