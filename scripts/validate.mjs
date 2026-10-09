import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const requiredFiles = ['index.html', 'styles.css', 'app.js', 'favicon.svg', 'data/lessons.json', 'data/audit.json', 'vercel.json'];
const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required file: ${file}`);
}

const lessons = JSON.parse(fs.readFileSync(path.join(root, 'data/lessons.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'data/audit.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

if (!Array.isArray(lessons) || lessons.length !== 467) failures.push(`Expected 467 lessons; received ${lessons.length}`);
if (new Set(lessons.map((lesson) => lesson.id)).size !== lessons.length) failures.push('Lesson IDs must be unique');
if (!lessons.every((lesson) => Number.isFinite(lesson.number) && lesson.id && Array.isArray(lesson.flags))) failures.push('Lesson schema validation failed');
if (audit.totalRecords !== lessons.length) failures.push('Audit total does not match lesson data');
if (!html.includes('<meta name="description"') || !html.includes('favicon.svg')) failures.push('SEO metadata or favicon is missing');
if (!app.includes("utterance.lang = 'en-GB'")) failures.push('British English speech language lock is missing');
if (/en-US|en_US/.test(app)) failures.push('American English fallback must not be present');
if (!app.includes('speechSynthesis.cancel()')) failures.push('Audio cancellation guard is missing');
if (!app.includes('localStorage.setItem')) failures.push('Local progress persistence is missing');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validation passed: ${lessons.length} lessons, ${audit.needsReviewCount} marked Needs Review.`);
