import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

/**
 * Deterministic DOCX + PDF renderers for the draft DRHP. Both apply a
 * "DRAFT — FOR AUTHORISED INTERMEDIARY REVIEW" watermark unless the draft is
 * fully approved (the intermediary gate — see task 5.4). Pure functions (take
 * data, return bytes) so they are testable without a DB or browser.
 */

export const WATERMARK_TEXT = "DRAFT — FOR AUTHORISED INTERMEDIARY REVIEW";

export type ExportSection = { title: string; ordinal: number; markdown: string };
export type ExportInput = {
  projectName: string;
  board: string;
  sections: ExportSection[];
  watermarked: boolean;
  generatedAt: string;
};

type Line = { text: string; kind: "h1" | "h2" | "h3" | "gap" | "body" };

function pdfSafeText(text: string): string {
  return text
    .replace(/\u2011/g, "-")
    .replace(/\u202f/g, " ")
    .replace(/₹/g, "INR ");
}

/** Parse a section's markdown into typed lines (headings / gap / body). */
function toLines(markdown: string): Line[] {
  return markdown
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((raw): Line | null => {
      const line = raw.trimEnd();
      if (line.trim() === "") return null;
      if (line.startsWith("### ")) return { text: line.slice(4), kind: "h3" };
      if (line.startsWith("## ")) return { text: line.slice(3), kind: "h2" };
      if (line.startsWith("# ")) return { text: line.slice(2), kind: "h1" };
      if (/\[\[GAP:/i.test(line)) return { text: line, kind: "gap" };
      return { text: line, kind: "body" };
    })
    .filter((l): l is Line => l !== null);
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------
export async function buildDocx(input: ExportInput): Promise<Uint8Array> {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 200 },
      children: [new TextRun({ text: input.projectName, bold: true, size: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "DRAFT RED HERRING PROSPECTUS", bold: true, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: `${input.board.replace("_", " ")} · Generated ${input.generatedAt}`, size: 20 })],
    }),
  ];

  for (const section of [...input.sections].sort((a, b) => a.ordinal - b.ordinal)) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun({ text: section.title })],
      }),
    );
    for (const line of toLines(section.markdown)) {
      if (line.kind === "h1" || line.kind === "h2" || line.kind === "h3") {
        const level =
          line.kind === "h1" ? HeadingLevel.HEADING_2 : line.kind === "h2" ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4;
        children.push(new Paragraph({ heading: level, children: [new TextRun({ text: line.text })] }));
      } else if (line.kind === "gap") {
        children.push(
          new Paragraph({ children: [new TextRun({ text: line.text, italics: true, color: "B91C1C" })] }),
        );
      } else {
        children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: line.text })] }));
      }
    }
  }

  const header = input.watermarked
    ? new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: WATERMARK_TEXT, bold: true, color: "B91C1C", size: 18 })],
          }),
        ],
      })
    : undefined;

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16 })],
      }),
    ],
  });

  const doc = new Document({
    sections: [{ headers: header ? { default: header } : undefined, footers: { default: footer }, children }],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
export async function buildPdf(input: ExportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const A4 = { w: 595.28, h: 841.89 };
  const margin = 56;
  const maxWidth = A4.w - margin * 2;

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - margin;

  const applyWatermark = (p: ReturnType<typeof pdf.addPage>) => {
    if (!input.watermarked) return;
    p.drawText(WATERMARK_TEXT, {
      x: 50,
      y: 300,
      size: 18,
      font: bold,
      color: rgb(0.85, 0.1, 0.1),
      rotate: degrees(45),
      opacity: 0.12,
    });
  };
  applyWatermark(page);

  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    applyWatermark(page);
    y = A4.h - margin;
  };

  const wrap = (text: string, f: typeof font, size: number): string[] => {
    const words = pdfSafeText(text).split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const draw = (text: string, f: typeof font, size: number, color = rgb(0.1, 0.1, 0.1)) => {
    for (const line of wrap(text, f, size)) {
      if (y < margin + 24) newPage();
      page.drawText(line, { x: margin, y, size, font: f, color });
      y -= size + 4;
    }
  };

  // Title block.
  y -= 120;
  draw(input.projectName, bold, 22);
  y -= 6;
  draw("DRAFT RED HERRING PROSPECTUS", bold, 14);
  draw(`${input.board.replace("_", " ")} · Generated ${input.generatedAt}`, font, 10, rgb(0.4, 0.4, 0.4));

  for (const section of [...input.sections].sort((a, b) => a.ordinal - b.ordinal)) {
    newPage();
    draw(section.title, bold, 16);
    y -= 6;
    for (const line of toLines(section.markdown)) {
      if (line.kind === "h1" || line.kind === "h2" || line.kind === "h3") {
        y -= 4;
        draw(line.text, bold, line.kind === "h1" ? 13 : 11);
      } else if (line.kind === "gap") {
        draw(line.text, font, 10, rgb(0.72, 0.11, 0.11));
      } else {
        draw(line.text, font, 10);
      }
    }
  }

  // Page numbers.
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: A4.w / 2 - 40,
      y: 28,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return pdf.save();
}
