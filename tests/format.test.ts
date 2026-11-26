import { describe, expect, test } from "bun:test";
import { escapeHtml, markdownToTelegramHtml as md } from "../src/delivery/format";

describe("markdownToTelegramHtml", () => {
  test("escapes html", () => {
    expect(escapeHtml("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
    expect(md("1 < 2 & <script>")).toBe("1 &lt; 2 &amp; &lt;script&gt;");
  });

  test("bold and italic", () => {
    expect(md("**Bold** and __also__")).toBe("<b>Bold</b> and <b>also</b>");
    expect(md("an *italic* and _this_")).toBe("an <i>italic</i> and <i>this</i>");
  });

  test("leaves snake_case and url underscores alone", () => {
    expect(md("use snake_case_name here")).toBe("use snake_case_name here");
    expect(md("see https://x.com/a_b_c")).toBe("see https://x.com/a_b_c");
  });

  test("inline code is escaped and not formatted", () => {
    expect(md("run `a<b> **x**`")).toBe("run <code>a&lt;b&gt; **x**</code>");
  });

  test("links", () => {
    expect(md("[AP News](https://apnews.com/a?b=1&c=2)")).toBe(
      '<a href="https://apnews.com/a?b=1&amp;c=2">AP News</a>',
    );
  });

  test("headings and bullets", () => {
    expect(md("## Dünya\n- bir\n* iki")).toBe("<b>Dünya</b>\n• bir\n• iki");
  });

  test("fenced code becomes pre", () => {
    expect(md("```ts\nconst a = 1 < 2;\n```")).toBe("<pre>const a = 1 &lt; 2;</pre>");
  });

  test("unclosed fence runs to end", () => {
    expect(md("```\nx\ny")).toBe("<pre>x\ny</pre>");
  });
});
