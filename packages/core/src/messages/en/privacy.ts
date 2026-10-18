/**
 * The public privacy statement at `/privacy` — legal text, linked from the
 * phone's Settings and from the store listings, so it renders signed out.
 *
 * Section bodies are keyed records rather than arrays so the core message
 * test compares every paragraph and list item between locales, not only the
 * section titles.
 *
 * **When a Module starts storing a new kind of data, or a new service starts
 * receiving any, say so here in the same change.** Nothing enforces it: the
 * inventory below was read off `convex/schema.ts` and every outbound `fetch`
 * on the date in `updated`, and it is only as true as the last person who
 * re-read them.
 */
export const privacy = {
  title: 'Privacy statement',
  updated: 'Last updated: 18 October 2026',
  intro: {
    title: 'Who we are',
    body: {
      who: 'Gather is an app for running a household together — recipes, meal plans, groceries, tasks, notes, a calendar, a baby log, household finances and tasting notes — available as a mobile app and as a web app at gather.appelent.nl. Gather is developed by Appelent, which is responsible for processing your personal data as described in this statement.',
      contact:
        'For questions about this statement or your data, email privacy@appelent.nl.',
    },
  },
  collect: {
    title: 'What we collect',
    items: {
      account:
        'Account details: your name, email address, profile photo and sign-in information.',
      groups:
        'Groups: the Groups you create or join, who their Members are, each Member’s role, the invite code, and your own choices per Group, such as pinned modules and calendar views.',
      food: 'Recipes and meals: recipes (including ones you import from a web address), meal plans, grocery and pantry lists.',
      tasks:
        'Tasks: task lists and tasks. If a Member connects Notion or Todoist, we store an access token for that service so Gather can read and update the connected list.',
      notes:
        'Notes and calendar: notes, calendars and events, including locations, times and who an event is for.',
      baby: 'Baby log: details about a child — name, date of birth and, if you enter it, sex — and what you log about them: feeding, diapers, sleep, temperature, growth, medication, vaccinations, notes and memories with photos. This includes health data about a child.',
      finances:
        'Household finances: recurring costs, shared-cost splits, savings goals, houses and mortgage calculations, investment holdings and transactions, and net-worth entries. Every figure is one a Member typed in; Gather never connects to a bank, broker or other financial account.',
      nutrition:
        'Nutrition: your food diary, foods you add, combos and nutrition targets. This can be health data.',
      tastings:
        'Tastings: the cheeses, wines and beers you log, with ratings and notes.',
      photos:
        'Photos you add to a Group, a recipe, a child, a baby-log entry or a tasting, and your profile photo.',
      reports:
        'Problem reports: the message you send with Report an issue in the web app, the address of the page you were on (without anything after the path), and whether you were signed in. Your name, email address and account ID are not included.',
      errors:
        'Error reports: when something goes wrong in the web app, a technical report of the error, described under Service providers below.',
      device:
        'On your device: preferences such as language and appearance, and caches. These stay on the device.',
    },
  },
  visibility: {
    title: 'Who can see it',
    body: {
      group:
        'What you add to a Group is visible to every Member of that Group. A recipe can also be shared into a second Group, which makes it visible to that Group’s Members too. Members see each other’s names, not email addresses.',
      personal:
        'Your food diary, combos and nutrition targets are personal: they follow you into every Group and are visible to no one else.',
      photos:
        'Photos are served from a link that is long and impossible to guess, but that does not require sign-in and does not expire. Anyone you pass such a link on to can open the photo.',
    },
  },
  purposes: {
    title: 'Why we use it',
    body: {
      service:
        'We use your data to provide Gather: to keep your account, store what you and your Group add, sync it across devices and show it to the Members of your Group. This is necessary to perform our agreement with you.',
      health:
        'We process health data — the baby log and your nutrition — based on explicit consent, given by entering it. Health data about a child should be entered only by a parent or guardian. You can withdraw consent at any time by deleting that data.',
      reports:
        'We use problem reports and error reports to find and fix errors, based on our legitimate interest in a reliable app.',
      noAds:
        'We do not sell your data, show advertising, or use your data for marketing or profiling.',
    },
  },
  providers: {
    title: 'Service providers',
    intro:
      'We use the following providers to run Gather. They process data only on our behalf.',
    items: {
      clerk: 'Clerk: sign-in and account management.',
      convex:
        'Convex: database and file storage, hosted in the European Union (Ireland).',
      cloudflare: 'Cloudflare: hosting of the web app.',
      expo: 'Expo: building the mobile app and delivering its updates.',
      anthropic:
        'Anthropic: AI help with recipes, in two cases and only when you ask for it. When you import a recipe from a web address and the page does not describe the recipe in a standard format, the text of that public page is sent to recognise the recipe. When you ask Gather to estimate a recipe’s nutrition, its ingredient lines and number of servings are sent. Neither is sent with your name or email address, and Anthropic does not use it to train models. Each person can make a limited number of these AI requests per day; to enforce that limit we keep a count of how many requests you made on each day, which is deleted with your account.',
      github:
        'GitHub: problem reports from the web app are filed as issues in Gather’s public code repository, so the message and the page address are publicly visible there. Do not put personal details in a report.',
      sentry:
        'We use Sentry (Functional Software, Inc.) as a processor for error reports from the web app and its server. A report contains the error message and stack trace (error messages from Gather’s backend are withheld), the page URL without its query string, browser/OS and app release, a short trail of the pages visited and network requests made just before the error (addresses without their query string, request methods and status codes only), and an anonymous event ID. It does not contain request bodies, cookies, headers, your name or email, or the content you enter, and session replay is not used.',
      googleFonts:
        'Google Fonts: the web app loads its fonts from Google, which receives your IP address when a page loads.',
    },
    integrations:
      'If a Member of your Group connects Notion or Todoist, the tasks in the connected list are read from and written to that service under that Member’s account there. Their own privacy policies apply to what they store.',
    openFoodFacts:
      'When you scan a barcode or search for a food, the barcode or search text is sent to Open Food Facts to look up product information. This request is not linked to your account.',
    recipeImport:
      'When you import a recipe from a web address, our server fetches that page. The website sees a request from our server, not from you.',
    transfers:
      'Some providers may process data outside the European Economic Area. In that case, transfers rely on appropriate safeguards, such as the EU–US Data Privacy Framework or the European Commission’s Standard Contractual Clauses.',
  },
  retention: {
    title: 'How long we keep it',
    body: {
      account:
        'We keep your data for as long as you have an account. When you delete your account, it is deleted as described below.',
      shared:
        'A Group is shared by its Members. When you delete your account, Groups where you are the only Member are deleted with everything in them. From Groups you share with others you are removed, and what you added there stays with that Group, because it belongs to the household rather than to one person.',
      reports:
        'Problem reports stay in the public repository until they are removed. Ask us at privacy@appelent.nl and we remove yours.',
    },
  },
  deletion: {
    title: 'Delete your Gather account',
    body: {
      inApp:
        'In the Gather mobile app, go to Settings → Account → Delete account. The app lists which Groups are deleted and which ones you only leave before you confirm. Your account is deleted right away, and your data within minutes.',
      noApp:
        'Without the app, email privacy@appelent.nl from the email address on your Gather account, with the subject “Delete my Gather account”. We confirm your request and delete your account and data within 30 days.',
      what: 'Deleting your account deletes your account details, your personal nutrition data and every Group in which you are the only Member, including its baby log, finances and photos. What you added to a Group you share with others stays with that Group, as described above.',
    },
  },
  rights: {
    title: 'Your rights',
    body: {
      rights:
        'You have the right to access, correct, delete, or export your data, to restrict or object to its processing, and to withdraw consent.',
      howTo:
        'You can correct most of your data directly in the app, and delete your account as described above. For any other request, email privacy@appelent.nl. We respond within one month.',
      complaint:
        'If you are not satisfied with how we handle your data, you can file a complaint with the Dutch Data Protection Authority (Autoriteit Persoonsgegevens) or the data protection authority in your country.',
    },
  },
  security: {
    title: 'Security',
    body: 'Data is sent over encrypted connections, and what is in a Group can only be reached by signed-in Members of that Group — apart from photo links, as described above.',
  },
  children: {
    title: 'Children',
    body: 'Gather is not intended for children under 16. The baby log holds data about a child, entered by their parent or guardian.',
  },
  changes: {
    title: 'Changes',
    body: 'We may update this statement. The date at the top shows the latest version.',
  },
}
