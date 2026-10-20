// src/services/document.service.ts
//
// ── YEH FILE KYU HAI ─────────────────────────────────────────────────────
// Credential snapshot → PDF bytes. Teen templates:
//   offer_letter            A4 portrait  (payment ke baad)
//   completion_letter       A4 portrait  (project approve + batch khatam)
//   completion_certificate  A4 landscape (wahi time)
//
// pdf-lib kyun (Puppeteer nahi): koi Chrome download nahi, kam memory,
// chhote VPS pe fast. Trade-off: layout code mein draw hota hai.
//
// FONT LIMIT: pdf-lib ke built-in fonts (Times, Helvetica) sirf Latin
// characters chhaap sakte hai. Isliye:
//   - certificateName validator English letters hi leta hai
//   - baaki har text `pdfSafe()` se guzarta hai - unsupported character
//     PDF crash nahi karta, '?' ban jaata hai
// Pure function - DB/Redis nahi chhoota, seedha test ho sakta hai.
// ────────────────────────────────────────────────────────────────────────

import fs from 'fs/promises';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { ICredentialSnapshot, CredentialType } from '../models/credential.model';
import { verifyBaseUrl, brandingAssets } from '../config/issuer';

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const INK = rgb(0.06, 0.07, 0.09);
const MUTED = rgb(0.36, 0.39, 0.45);
const ACCENT = rgb(0.22, 0.55, 0.86); // sky blue - website se match
const MARGIN = 56;

// Smart quotes/dashes → ASCII, aur jo WinAnsi (Latin-1) mein nahi woh '?'
export const pdfSafe = (text: string): string =>
  text
    .replace(/[\u2018\u2019\u02BC]/g, "'") // curly single quotes, modifier apostrophe
    .replace(/[\u201C\u201D]/g, '"') // curly double quotes
    .replace(/[\u2013\u2014]/g, '-') // en / em dash
    .replace(/\u2026/g, '...') // ellipsis
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?'); // anything outside Latin-1 (WinAnsi)

const formatDate = (d: Date) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

// Words ko lines mein todo taaki maxWidth se bahar na jaye
const wrap = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const word of pdfSafe(text).split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

interface Fonts {
  serif: PDFFont;
  serifBold: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

// Paragraph draw karo, neeche wali y position return
const paragraph = (page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size = 11, lineGap = 5) => {
  for (const line of wrap(text, font, size, maxWidth)) {
    page.drawText(line, { x, y, size, font, color: INK });
    y -= size + lineGap;
  }
  return y;
};

// Centered single line. Bahut lamba text (e.g. lamba college naam) border
// se bahar na jaye - font size chhota hota jaata hai jab tak fit na ho (min 8)
const centered = (page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) => {
  const safe = pdfSafe(text);
  const maxWidth = page.getWidth() - 140;
  let fitted = size;
  while (fitted > 8 && font.widthOfTextAtSize(safe, fitted) > maxWidth) fitted -= 0.5;
  const width = font.widthOfTextAtSize(safe, fitted);
  page.drawText(safe, { x: (page.getWidth() - width) / 2, y, size: fitted, font, color });
};

const tryEmbedPng = async (doc: PDFDocument, file: string) => {
  try {
    return await doc.embedPng(await fs.readFile(file));
  } catch {
    return null; // asset abhi nahi hai - text-only chalega
  }
};

// Letterhead: issuer (GrewDo) - legal entity; brand (Beyownd) right side
const drawLetterhead = async (doc: PDFDocument, page: PDFPage, s: ICredentialSnapshot, f: Fonts) => {
  const { width, height } = page.getSize();
  let y = height - MARGIN;
  const logo = await tryEmbedPng(doc, brandingAssets.logoPng);
  let x = MARGIN;
  if (logo) {
    const dims = logo.scaleToFit(44, 44);
    page.drawImage(logo, { x, y: y - dims.height + 6, ...dims });
    x += dims.width + 12;
  }
  page.drawText(pdfSafe(s.issuer.legalName), { x, y: y - 14, size: 20, font: f.serifBold, color: INK });
  const brand = pdfSafe(s.issuer.programName);
  page.drawText(brand, { x: width - MARGIN - f.sans.widthOfTextAtSize(brand, 9), y: y - 12, size: 9, font: f.sans, color: ACCENT });
  y -= 32;
  const meta = `${s.issuer.address}  |  ${s.issuer.registrationNo}  |  ${s.issuer.email}`;
  for (const line of wrap(meta, f.sans, 8.5, width - MARGIN * 2)) {
    page.drawText(line, { x: MARGIN, y, size: 8.5, font: f.sans, color: MUTED });
    y -= 12;
  }
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 1, color: ACCENT });
  return y - 28;
};

// QR + ID + "product of" line - har document ke neeche
const drawVerifyFooter = async (doc: PDFDocument, page: PDFPage, s: ICredentialSnapshot, credentialId: string, f: Fonts) => {
  const url = `${verifyBaseUrl}/${credentialId}`;
  const qr = await doc.embedPng(await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 240 }));
  const size = 72;
  const y = MARGIN - 10;
  page.drawImage(qr, { x: MARGIN, y, width: size, height: size });
  const tx = MARGIN + size + 14;
  page.drawText(`Credential ID: ${credentialId}`, { x: tx, y: y + 50, size: 10, font: f.sansBold, color: INK });
  page.drawText(pdfSafe(`Verify at ${url}`), { x: tx, y: y + 34, size: 9, font: f.sans, color: ACCENT });
  page.drawText(pdfSafe(`${s.issuer.brand} is a product of ${s.issuer.legalName}.`), { x: tx, y: y + 18, size: 8.5, font: f.sans, color: MUTED });
};

const drawSignature = async (doc: PDFDocument, page: PDFPage, s: ICredentialSnapshot, x: number, y: number, f: Fonts) => {
  page.drawText(pdfSafe(`For ${s.issuer.legalName}`), { x, y, size: 11, font: f.sans, color: INK });
  const sig = await tryEmbedPng(doc, brandingAssets.signaturePng);
  let sy = y - 14;
  if (sig) {
    const dims = sig.scaleToFit(140, 44);
    page.drawImage(sig, { x, y: sy - dims.height, ...dims });
    sy -= dims.height + 6;
  } else {
    sy -= 34;
  }
  page.drawLine({ start: { x, y: sy }, end: { x: x + 160, y: sy }, thickness: 0.6, color: MUTED });
  page.drawText(pdfSafe(s.issuer.signatoryName), { x, y: sy - 14, size: 11, font: f.sansBold, color: INK });
  page.drawText(pdfSafe(s.issuer.signatoryTitle), { x, y: sy - 28, size: 10, font: f.sans, color: MUTED });
};

const buildLetter = async (
  doc: PDFDocument,
  s: ICredentialSnapshot,
  credentialId: string,
  f: Fonts,
  title: string,
  subject: string,
  body: string[]
) => {
  const page = doc.addPage(A4_PORTRAIT);
  const width = page.getWidth() - MARGIN * 2;
  let y = await drawLetterhead(doc, page, s, f);

  page.drawText(`Date: ${formatDate(s.issuedAt)}`, { x: MARGIN, y, size: 10, font: f.sans, color: INK });
  const ref = `Ref: ${credentialId}`;
  page.drawText(ref, { x: page.getWidth() - MARGIN - f.sans.widthOfTextAtSize(ref, 10), y, size: 10, font: f.sans, color: INK });
  y -= 30;

  page.drawText('To,', { x: MARGIN, y, size: 11, font: f.sans, color: INK });
  y -= 16;
  page.drawText(pdfSafe(s.studentName), { x: MARGIN, y, size: 11, font: f.sansBold, color: INK });
  y -= 15;
  y = paragraph(page, s.collegeName, MARGIN, y, width, f.sans, 11);
  y -= 18;

  centered(page, title, y, f.serifBold, 16);
  y -= 26;
  y = paragraph(page, `Subject: ${subject}`, MARGIN, y, width, f.sansBold, 11);
  y -= 10;
  for (const p of body) {
    y = paragraph(page, p, MARGIN, y, width, f.sans, 11, 6);
    y -= 10;
  }
  await drawSignature(doc, page, s, MARGIN, y - 10, f);
  await drawVerifyFooter(doc, page, s, credentialId, f);
};

const buildCertificate = async (doc: PDFDocument, s: ICredentialSnapshot, credentialId: string, f: Fonts) => {
  const page = doc.addPage(A4_LANDSCAPE);
  const { width, height } = page.getSize();
  // Double border
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: ACCENT, borderWidth: 2 });
  page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64, borderColor: ACCENT, borderWidth: 0.6 });

  centered(page, s.issuer.legalName.toUpperCase(), height - 78, f.sansBold, 11, MUTED);
  centered(page, 'CERTIFICATE OF COMPLETION', height - 128, f.serifBold, 30);
  centered(page, s.issuer.programName, height - 154, f.sans, 12, ACCENT);
  centered(page, 'This is to certify that', height - 200, f.serif, 14, MUTED);
  centered(page, s.studentName, height - 244, f.serifBold, 34);
  centered(page, `of ${s.collegeName}`, height - 270, f.serif, 13, MUTED);
  centered(page, 'has successfully completed the virtual internship in', height - 304, f.serif, 14, MUTED);
  centered(page, s.courseTitle, height - 334, f.serifBold, 22);
  centered(
    page,
    `${formatDate(s.startDate)} - ${formatDate(s.endDate)}  (${s.durationWeeks} weeks)  |  Batch ${s.cohortCode}`,
    height - 360,
    f.sans,
    11,
    MUTED
  );
  if (s.skills.length) centered(page, `Skills: ${s.skills.join(', ')}`, height - 382, f.sans, 10, MUTED);

  // Signature bottom-right, QR + ID bottom-left
  await drawSignature(doc, page, s, width - MARGIN - 190, 150, f);
  await drawVerifyFooter(doc, page, s, credentialId, f);
};

export const renderCredentialPdf = async (
  type: CredentialType,
  s: ICredentialSnapshot,
  credentialId: string
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`${type.replace(/_/g, ' ')} - ${s.studentName} - ${credentialId}`));
  doc.setAuthor(pdfSafe(s.issuer.legalName));
  doc.setSubject(pdfSafe(s.issuer.programName));
  doc.setCreator('Beyownd');

  const f: Fonts = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const period = `${formatDate(s.startDate)} to ${formatDate(s.endDate)} (${s.durationWeeks} weeks)`;

  if (type === 'offer_letter') {
    await buildLetter(doc, s, credentialId, f, 'OFFER LETTER', `Offer of Virtual Internship - ${s.courseTitle}`, [
      `Dear ${s.studentName},`,
      `We are pleased to offer you a virtual internship in ${s.courseTitle} under the ${s.issuer.programName}, conducted by ${s.issuer.legalName}. The internship will run from ${period}, as part of batch ${s.cohortCode}.`,
      'This is a remote, project-based internship. During the internship you will complete structured learning modules, an assessment at the end of each module, and a final project that is reviewed by a mentor. A completion certificate and completion letter will be issued after the internship period ends and your project is approved.',
      'We look forward to working with you.',
    ]);
  } else if (type === 'completion_letter') {
    await buildLetter(doc, s, credentialId, f, 'INTERNSHIP COMPLETION LETTER', `Completion of Virtual Internship - ${s.courseTitle}`, [
      'To whom it may concern,',
      `This is to certify that ${s.studentName}, a student of ${s.collegeName}, has successfully completed a virtual internship in ${s.courseTitle} under the ${s.issuer.programName}, conducted by ${s.issuer.legalName}, from ${period}, as part of batch ${s.cohortCode}.`,
      `During the internship, the intern completed all learning modules and module assessments, and built a final project that was reviewed and approved by a mentor.${s.skills.length ? ` Skills covered include ${s.skills.join(', ')}.` : ''}`,
      'We wish them every success in their future endeavours.',
    ]);
  } else {
    await buildCertificate(doc, s, credentialId, f);
  }

  return doc.save();
};
