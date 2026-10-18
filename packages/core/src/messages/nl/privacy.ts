import type { privacy as enPrivacy } from '../en/privacy'

export const privacy = {
  title: 'Privacyverklaring',
  updated: 'Laatst bijgewerkt: 18 oktober 2026',
  intro: {
    title: 'Wie we zijn',
    body: {
      who: 'Gather is een app om samen een huishouden te runnen — recepten, maaltijdplanning, boodschappen, taken, notities, een agenda, een babylogboek, huishoudfinanciën en proefnotities — beschikbaar als mobiele app en als webapp op gather.appelent.nl. Gather wordt ontwikkeld door Appelent. Appelent is verantwoordelijk voor de verwerking van je persoonsgegevens zoals beschreven in deze verklaring.',
      contact:
        'Voor vragen over deze verklaring of je gegevens kun je mailen naar privacy@appelent.nl.',
    },
  },
  collect: {
    title: 'Welke gegevens we verzamelen',
    items: {
      account:
        'Accountgegevens: je naam, e-mailadres, profielfoto en inloggegevens.',
      groups:
        'Groepen: de Groepen die je aanmaakt of waar je lid van wordt, wie de Leden zijn, de rol van elk Lid, de uitnodigingscode, en je eigen keuzes per Groep, zoals vastgepinde modules en agendaweergaven.',
      food: 'Recepten en maaltijden: recepten (ook recepten die je importeert vanaf een webadres), maaltijdplanningen, boodschappen- en voorraadlijsten.',
      tasks:
        'Taken: takenlijsten en taken. Als een Lid Notion of Todoist koppelt, bewaren we een toegangstoken voor die dienst, zodat Gather de gekoppelde lijst kan lezen en bijwerken.',
      notes:
        'Notities en agenda: notities, agenda’s en afspraken, met locaties, tijden en voor wie een afspraak is.',
      baby: 'Babylogboek: gegevens over een kind — naam, geboortedatum en, als je dat invult, geslacht — en wat je over het kind vastlegt: voedingen, luiers, slaap, temperatuur, groei, medicatie, vaccinaties, notities en herinneringen met foto’s. Dit omvat gezondheidsgegevens over een kind.',
      finances:
        'Huishoudfinanciën: vaste lasten, verdelingen van gedeelde kosten, spaardoelen, huizen en hypotheekberekeningen, beleggingen en transacties, en vermogensposten. Elk bedrag is door een Lid ingetypt; Gather koppelt nooit met een bank, broker of andere financiële rekening.',
      nutrition:
        'Voeding: je voedingsdagboek, voedingsmiddelen die je toevoegt, combinaties en voedingsdoelen. Dit kunnen gezondheidsgegevens zijn.',
      tastings:
        'Proeverijen: de kazen, wijnen en bieren die je vastlegt, met beoordelingen en notities.',
      photos:
        'Foto’s die je toevoegt aan een Groep, een recept, een kind, een regel in het babylogboek of een proeverij, en je profielfoto.',
      reports:
        'Probleemmeldingen: het bericht dat je in de webapp verstuurt via Probleem melden, de pagina waarop je was, en je naam, e-mailadres en account-ID.',
      device:
        'Op je toestel: voorkeuren zoals taal en weergave, en caches. Deze blijven op het toestel.',
    },
  },
  visibility: {
    title: 'Wie het kan zien',
    body: {
      group:
        'Wat je aan een Groep toevoegt, is zichtbaar voor alle Leden van die Groep. Een recept kun je ook delen met een tweede Groep; dan is het ook zichtbaar voor de Leden daarvan. Leden zien elkaars naam, niet elkaars e-mailadres.',
      personal:
        'Je voedingsdagboek, combinaties en voedingsdoelen zijn persoonlijk: ze gaan met je mee naar elke Groep en zijn voor niemand anders zichtbaar.',
      photos:
        'Foto’s worden geladen via een link die lang is en niet te raden, maar waarvoor je niet hoeft in te loggen en die niet verloopt. Iedereen aan wie je zo’n link doorgeeft, kan de foto openen.',
    },
  },
  purposes: {
    title: 'Waarom we ze gebruiken',
    body: {
      service:
        'We gebruiken je gegevens om Gather te leveren: om je account bij te houden, op te slaan wat jij en je Groep toevoegen, dat tussen toestellen te synchroniseren en het te tonen aan de Leden van je Groep. Dit is nodig om onze overeenkomst met jou uit te voeren.',
      health:
        'We verwerken gezondheidsgegevens — het babylogboek en je voeding — op basis van uitdrukkelijke toestemming, die je geeft door ze in te voeren. Gezondheidsgegevens over een kind horen alleen door een ouder of verzorger te worden ingevoerd. Je kunt je toestemming altijd intrekken door die gegevens te verwijderen.',
      reports:
        'We gebruiken probleemmeldingen om fouten te vinden en op te lossen, op basis van ons gerechtvaardigd belang bij een betrouwbare app.',
      noAds:
        'We verkopen je gegevens niet, tonen geen advertenties en gebruiken je gegevens niet voor marketing of profilering.',
    },
  },
  providers: {
    title: 'Dienstverleners',
    intro:
      'We gebruiken de volgende dienstverleners om Gather te laten werken. Zij verwerken gegevens alleen in onze opdracht.',
    items: {
      clerk: 'Clerk: inloggen en accountbeheer.',
      convex:
        'Convex: database en bestandsopslag, gehost in de Europese Unie (Ierland).',
      cloudflare: 'Cloudflare: hosting van de webapp.',
      expo: 'Expo: het bouwen van de mobiele app en het leveren van updates daarvoor.',
      anthropic:
        'Anthropic: hulp met AI bij recepten, in twee gevallen en alleen als jij erom vraagt. Als je een recept importeert vanaf een webadres en de pagina het recept niet in een standaardformaat beschrijft, wordt de tekst van die openbare pagina verstuurd om het recept te herkennen. Als je Gather de voedingswaarde van een recept laat schatten, worden de ingrediëntregels en het aantal porties verstuurd. In geen van beide gevallen gaan je naam of e-mailadres mee, en Anthropic gebruikt het niet om modellen te trainen.',
      github:
        'GitHub: probleemmeldingen uit de webapp worden als issue vastgelegd in de openbare coderepository van Gather. Het bericht, het paginaadres en je naam, e-mailadres en account-ID zijn daar dus openbaar zichtbaar.',
      googleFonts:
        'Google Fonts: de webapp laadt zijn lettertypen bij Google, dat je IP-adres ontvangt als een pagina laadt.',
    },
    integrations:
      'Als een Lid van je Groep Notion of Todoist koppelt, worden de taken in de gekoppelde lijst gelezen uit en geschreven naar die dienst, onder het account van dat Lid daar. Voor wat zij opslaan geldt hun eigen privacybeleid.',
    openFoodFacts:
      'Als je een barcode scant of een voedingsmiddel zoekt, wordt de barcode of zoektekst naar Open Food Facts gestuurd om productinformatie op te halen. Dit verzoek is niet gekoppeld aan je account.',
    recipeImport:
      'Als je een recept importeert vanaf een webadres, haalt onze server die pagina op. De website ziet een verzoek van onze server, niet van jou.',
    transfers:
      'Sommige dienstverleners kunnen gegevens buiten de Europese Economische Ruimte verwerken. In dat geval gebeurt de doorgifte met passende waarborgen, zoals het EU-VS-gegevensprivacykader of de standaardcontractbepalingen van de Europese Commissie.',
  },
  retention: {
    title: 'Hoe lang we ze bewaren',
    body: {
      account:
        'We bewaren je gegevens zolang je een account hebt. Als je je account verwijdert, worden ze verwijderd zoals hieronder beschreven.',
      shared:
        'Een Groep is van alle Leden samen. Als je je account verwijdert, worden Groepen waarvan jij het enige Lid bent verwijderd, met alles erin. Uit Groepen die je met anderen deelt word je verwijderd, en wat je daar hebt toegevoegd blijft bij die Groep, omdat het bij het huishouden hoort en niet bij één persoon.',
      reports:
        'Probleemmeldingen blijven in de openbare repository staan tot ze worden verwijderd. Vraag het ons via privacy@appelent.nl en we verwijderen de jouwe.',
    },
  },
  deletion: {
    title: 'Je Gather-account verwijderen',
    body: {
      inApp:
        'Ga in de mobiele app van Gather naar Instellingen → Account → Account verwijderen. Voordat je bevestigt, laat de app zien welke Groepen worden verwijderd en welke je alleen verlaat. Je account wordt direct verwijderd, en je gegevens binnen enkele minuten.',
      noApp:
        'Zonder de app: mail naar privacy@appelent.nl vanaf het e-mailadres van je Gather-account, met als onderwerp ‘Verwijder mijn Gather-account’. We bevestigen je verzoek en verwijderen je account en gegevens binnen 30 dagen.',
      what: 'Als je je account verwijdert, worden je accountgegevens, je persoonlijke voedingsgegevens en elke Groep waarvan jij het enige Lid bent verwijderd, inclusief het babylogboek, de financiën en de foto’s daarin. Wat je hebt toegevoegd aan een Groep die je met anderen deelt, blijft bij die Groep, zoals hierboven beschreven.',
    },
  },
  rights: {
    title: 'Je rechten',
    body: {
      rights:
        'Je hebt het recht je gegevens in te zien, te corrigeren, te verwijderen of te exporteren, de verwerking te beperken of er bezwaar tegen te maken, en je toestemming in te trekken.',
      howTo:
        'De meeste gegevens kun je zelf in de app corrigeren, en je account verwijderen zoals hierboven beschreven. Voor elk ander verzoek kun je mailen naar privacy@appelent.nl. We reageren binnen een maand.',
      complaint:
        'Ben je niet tevreden over hoe we met je gegevens omgaan, dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens of bij de toezichthouder in je eigen land.',
    },
  },
  security: {
    title: 'Beveiliging',
    body: 'Gegevens worden via versleutelde verbindingen verstuurd, en wat in een Groep staat is alleen bereikbaar voor ingelogde Leden van die Groep — behalve fotolinks, zoals hierboven beschreven.',
  },
  children: {
    title: 'Kinderen',
    body: 'Gather is niet bedoeld voor kinderen jonger dan 16 jaar. Het babylogboek bevat gegevens over een kind, ingevoerd door een ouder of verzorger.',
  },
  changes: {
    title: 'Wijzigingen',
    body: 'We kunnen deze verklaring aanpassen. De datum bovenaan toont de nieuwste versie.',
  },
} satisfies typeof enPrivacy
