/*
 * FAQ answers in one place: the landing FAQ, the /faq page and its FAQPage
 * JSON-LD all read from here, so they can never disagree. Answers are plain
 * text (JSON-LD needs text); an optional link is rendered after the answer.
 * Only facts the product actually does — no promises about college acceptance.
 */
export type FaqItem = { q: string; a: string; link?: { text: string; href: string } };

export const faqGroups: { title: string; items: FaqItem[] }[] = [
  {
    title: "The program",
    items: [
      { q: "Is this a real internship?", a: "It's a structured virtual internship program: a batch with real start and end dates, real work, and a final project reviewed by a mentor. Your documents say exactly that, so there's nothing to hide." },
      { q: "How long does it take?", a: "Each program runs for a fixed number of weeks, shown on the program card. The batch dates are the dates printed on your letters." },
      { q: "Do I need prior experience?", a: "No. Programs are beginner-friendly, and Module 1 of every program is free to preview before you pay." },
      { q: "How does a program work week to week?", a: "You go module by module. Each module has short lessons (reading or video) and ends with a quiz. The next module unlocks when you pass. After the last module you build and submit the final project." },
      { q: "When can I start?", a: "Paid lessons open on your batch start date. Until then you can read the free preview lessons and join your batch's community group." },
    ],
  },
  {
    title: "Certificates and verification",
    items: [
      { q: "Which documents do I get?", a: "An offer letter when you join a batch, then a completion certificate and a completion letter after you finish. Each has its own ID and QR code." },
      { q: "When do I get the certificate?", a: "After your batch end date, once you've finished every module and a mentor has approved your project. If you finish early, your dashboard shows the date it will be issued." },
      { q: "Will my college accept it?", a: "Every document can be verified online, and the letters follow the format colleges usually ask for. Requirements differ between colleges, so please check with your college or TPO before you enrol." },
      { q: "How does someone verify my certificate?", a: "They scan the QR code or enter the ID printed on the document at beyownd.in/verify. No login is needed. They see your name, college, program, batch dates and whether the document is valid.", link: { text: "Verify a document", href: "/verify" } },
      { q: "Can I change the name on my certificate?", a: "Yes, from your profile, until your first document is issued. After that the name is locked so it always matches what's printed. Enter it in English letters, exactly as it should appear." },
    ],
  },
  {
    title: "Payments and refunds",
    items: [
      { q: "Can I pay with UPI?", a: "Yes. You can pay with UPI, debit or credit cards, or net banking. It's a one-time payment." },
      { q: "Money was deducted but I'm not enrolled. What now?", a: "Don't pay again. Sometimes the confirmation takes a few minutes; your enrollment activates automatically once the payment is confirmed. If it still hasn't activated, email us with your payment ID." },
      { q: "Can I get a refund?", a: "The exact terms are in our policy:", link: { text: "Refund & Cancellation Policy", href: "/refund-policy" } },
    ],
  },
  {
    title: "Learning and technical",
    items: [
      { q: "What if I fail a quiz?", a: "No problem. You can retry after a one-minute wait, as many times as you need. You pass at 60%, and your best score is kept." },
      { q: "Can I study on my phone?", a: "Yes. The classroom is built for phones first: lessons, quizzes and your documents all work on a mobile browser. Building the final project is easier on a laptop or desktop." },
      { q: "How do I submit the final project?", a: "Push your code to a public GitHub repository and paste the link (plus a live link if you deployed it). A mentor reviews it against the rubric and either approves it or asks for changes, which you can fix and resubmit." },
    ],
  },
];

/** The shorter list shown on the landing page. */
export const landingFaqs: FaqItem[] = [
  faqGroups[0].items[0],
  faqGroups[1].items[2],
  faqGroups[0].items[1],
  faqGroups[1].items[1],
  faqGroups[2].items[0],
  faqGroups[3].items[0],
  faqGroups[0].items[2],
  faqGroups[2].items[2],
];
