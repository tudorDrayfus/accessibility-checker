type Translation = {
  category: string;
  title: string;
  why: string;
  fix: string;
  effort: "Quick win" | "Moderate" | "Complex";
  effortTime: string;
};

export const translations: Record<string, Translation> = {
  "color-contrast": {
    category: "Color & Contrast",
    title: "Text has low contrast",
    why: "Users with low vision or colour blindness can't read this text.",
    fix: "Increase the contrast ratio to at least 4.5:1 for normal text. Try darkening your text colour or lightening the background.",
    effort: "Quick win",
    effortTime: "< 1 hour",
  },
  "image-alt": {
    category: "Images & Icons",
    title: "Image is missing a description",
    why: "Screen reader users have no idea what this image shows.",
    fix: "Add an alt attribute describing what the image shows. If it's decorative, use alt=\"\".",
    effort: "Quick win",
    effortTime: "< 1 hour",
  },
  "label": {
    category: "Forms & Inputs",
    title: "Form input has no label",
    why: "Screen reader users can't tell what this field is for.",
    fix: "Add a <label> element linked to the input, or use aria-label.",
    effort: "Quick win",
    effortTime: "< 1 hour",
  },
  "heading-order": {
    category: "Structure",
    title: "Heading levels are skipped",
    why: "Users navigating by headings lose their place in the page structure.",
    fix: "Make sure headings go in order: H1 → H2 → H3. Don't skip levels for visual styling.",
    effort: "Moderate",
    effortTime: "2–4 hours",
  },
  "link-name": {
    category: "Navigation & Focus",
    title: "Link has no descriptive text",
    why: "Screen reader users hear 'click here' with no context of where it goes.",
    fix: "Replace vague link text like 'click here' with descriptive text like 'Read our pricing page'.",
    effort: "Quick win",
    effortTime: "< 1 hour",
  },
  "button-name": {
    category: "Navigation & Focus",
    title: "Button has no accessible name",
    why: "Screen reader users can't tell what this button does.",
    fix: "Add visible text inside the button, or use aria-label to describe its action.",
    effort: "Quick win",
    effortTime: "< 1 hour",
  },
  "html-has-lang": {
    category: "Structure",
    title: "Page has no language set",
    why: "Screen readers can't switch to the correct language pronunciation.",
    fix: "Add a lang attribute to your <html> tag, e.g. <html lang=\"en\">.",
    effort: "Quick win",
    effortTime: "5 minutes",
  },
  "document-title": {
    category: "Structure",
    title: "Page has no title",
    why: "Users can't identify this page in their browser tabs or history.",
    fix: "Add a descriptive <title> tag inside your <head>.",
    effort: "Quick win",
    effortTime: "5 minutes",
  },
  "landmark-one-main": {
    category: "Structure",
    title: "Page has no main landmark",
    why: "Keyboard users can't skip straight to the main content.",
    fix: "Wrap your main content in a <main> element.",
    effort: "Quick win",
    effortTime: "< 1 hour",
  },
  "keyboard": {
    category: "Navigation & Focus",
    title: "Element is not keyboard accessible",
    why: "Users who can't use a mouse are completely blocked from this element.",
    fix: "Make sure all interactive elements can be reached and activated with the Tab and Enter keys.",
    effort: "Complex",
    effortTime: "1–3 days",
  },
};

export const effortOrder = { "Quick win": 1, "Moderate": 2, "Complex": 3 };

export function translateViolation(id: string): Translation {
  return translations[id] ?? {
    category: "Other",
    title: id.replace(/-/g, " "),
    why: "This element doesn't meet accessibility standards.",
    fix: "Review the element and ensure it meets WCAG 2.1 AA guidelines.",
    effort: "Moderate",
    effortTime: "2–4 hours",
  };
}