// Copyright 2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

process.env.DEBUG = 'actions-on-google:*';
let apiaiapp = require('actions-on-google').ApiAiApp;
let express = require('express');
let bodyParser = require('body-parser');

let expressapp = express();
expressapp.use(bodyParser.json({type: 'application/json'}));

// API.AI actions
const UNRECOGNIZED_DEEP_LINK = 'deeplink.unknown';
const SAY_CAT_FACT = 'say_cat_fact';
const SAY_FOURTH_FACT = 'say_fourth_fact';

// API.AI parameter names
const CATEGORY_ARGUMENT = 'category';

// API.AI Contexts/lifespans
const FOURTH_CONTEXT = 'fourth-facts';
const CAT_CONTEXT = 'cat-facts';
const DEFAULT_LIFESPAN = 5;
const END_LIFESPAN = 0;

const FACT_TYPE = {
  HISTORY: 'history',
  HEADQUARTERS: 'headquarters',
  CATS: 'cats'
};

const HISTORY_FACTS = new Set([
  'Fourth was founded in 1999.',
  'Fourth was founded by Derek and Edwina Lilley.',
  'Fourth went public in 2004.',
  'Ben is Fourth employee #1, is still our CEO',
  'Fourth has 1,100 customers across the world in 60 countries.'
]);

const HQ_FACTS = new Set([
  'Fourth\'s headquarters is in London, Covent Garden.',
  'Fourth has over 30 cafeterias in its main campus.',
  'Fourth has over 10 fitness facilities in its main campus.'
]);

const CAT_FACTS = new Set([
  'Cats are animals.',
  'Cats have nine lives.',
  'Cats descend from other cats.'
]);

const GOOGLE_IMAGES = [
  [
    'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/Search_GSA.2e16d0ba.fill-300x300.png',
    'Google app logo'
  ],
  [
    'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/Google_Logo.max-900x900.png',
    'Google logo'
  ],
  [
    'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/Dinosaur-skeleton-at-Google.max-900x900.jpg',
    'Stan the Dinosaur at Googleplex'
  ],
  [
    'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/Wide-view-of-Google-campus.max-900x900.jpg',
    'Googleplex'
  ],
  [
    'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/Bikes-on-the-Google-campus.2e16d0ba.fill-300x300.jpg',
    'Biking at Googleplex'
  ]
];

const CAT_IMAGE = [
  'https://developers.google.com/web/fundamentals/accessibility/semantics-builtin/imgs/160204193356-01-cat-500.jpg',
  'Gray Cat'
];

const LINK_OUT_TEXT = 'Learn more';
const GOOGLE_LINK = 'https://www.google.com/about/';
const CATS_LINK = 'https://www.google.com/search?q=cats';
const NEXT_FACT_DIRECTIVE = ' Would you like to hear another fact?';
const CONFIRMATION_SUGGESTIONS = ['Sure', 'No thanks'];

const NO_INPUTS = [
  'I didn\'t hear that.',
  'If you\'re still there, say that again.',
  'We can stop here. See you soon.'
];

// This sample uses this sound from Freesound:
// 'cat meow' by tuberatanka (https://www.freesound.org/people/tuberatanka/sounds/110011/)
const MEOW_SRC = 'https://freesound.org/data/previews/110/110011_1537422-lq.mp3';

function getRandomImage (images) {
  let randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}

function getRandomFact (facts) {
  if (facts.size <= 0) {
    return null;
  }

  let randomIndex = (Math.random() * (facts.size - 1)).toFixed();
  let randomFactIndex = parseInt(randomIndex, 10);
  let counter = 0;
  let randomFact = '';
  for (let fact of facts.values()) {
    if (counter === randomFactIndex) {
      randomFact = fact;
      break;
    }
    counter++;
  }
  facts.delete(randomFact);
  return randomFact;
}

// [START fourth_facts]
expressapp.post('/', function (req, res) {
  const app = new apiaiapp({request: req, response: res});
  console.log('Request headers: ' + JSON.stringify(req.headers));
  console.log('Request body: ' + JSON.stringify(req.body));

  // Greet the user and direct them to next turn
  function unhandledDeepLinks (app) {
    if (app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT)) {
          app.ask(app.buildRichResponse()
            .addSimpleResponse(`Welcome to Facts about Fourth! I'd really rather \
    not talk about ${app.getRawInput()}. Wouldn't you rather talk about \
    Fourth? I can tell you about Fourth's history or its headquarters. \
    Which do you want to hear about?`)
            .addSuggestions(['History', 'Headquarters']), NO_INPUTS);
        } else {
          app.ask(`Welcome to Facts about Fourth! I'd really rather \
    not talk about ${app.getRawInput()}. \
    Wouldn't you rather talk about Fourth? I can tell you about \
    Fourth's history or its headquarters. Which do you want to hear about?`,
            NO_INPUTS);
    }
  }

  // Say a Fourth fact
  function tellFourthFact (app) {
    let historyFacts = app.data.historyFacts
      ? new Set(app.data.historyFacts) : HISTORY_FACTS;
    let hqFacts = app.data.hqFacts
      ? new Set(app.data.hqFacts) : HQ_FACTS;

    if (historyFacts.size === 0 && hqFacts.size === 0) {
      app.tell('Actually it looks like you heard it all. ' +
        'Thanks for listening!');
      return;
    }

    let factCategory = app.getArgument(CATEGORY_ARGUMENT);

    if (factCategory === FACT_TYPE.HISTORY) {
      let fact = getRandomFact(historyFacts);
      if (fact === null) {
        if (app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT)) {
          let suggestions = ['Headquarters'];
          if (!app.data.catFacts || app.data.catFacts.length > 0) {
            suggestions.push('Cats');
          }
          app.ask(app.buildRichResponse()
            .addSimpleResponse(noFactsLeft(app, factCategory, FACT_TYPE.HEADQUARTERS))
            .addSuggestions(suggestions), NO_INPUTS);
        } else {
          app.ask(noFactsLeft(app, factCategory, FACT_TYPE.HEADQUARTERS),
            NO_INPUTS);
        }
        return;
      }

      let factPrefix = 'Sure, here\'s a history fact. ';
      app.data.historyFacts = Array.from(historyFacts);
      if (true) {
              let image = getRandomImage(GOOGLE_IMAGES);
              app.ask(app.buildRichResponse()
                .addSimpleResponse(factPrefix)
                .addBasicCard(app.buildBasicCard(fact)
                  .addButton(LINK_OUT_TEXT, GOOGLE_LINK)
                  .setImage(image[0], image[1]))
                .addSimpleResponse(NEXT_FACT_DIRECTIVE)
                .addSuggestions(CONFIRMATION_SUGGESTIONS), NO_INPUTS);
            } else {
              app.ask(factPrefix + fact + NEXT_FACT_DIRECTIVE, NO_INPUTS);
      }
      return;
    } else if (factCategory === FACT_TYPE.HEADQUARTERS) {
      let fact = getRandomFact(hqFacts);
      if (fact === null) {
        if (app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT)) {
	          let suggestions = ['History'];
	          if (!app.data.catFacts || app.data.catFacts.length > 0) {
	            suggestions.push('Cats');
	          }
	          app.ask(app.buildRichResponse()
	            .addSimpleResponse(noFactsLeft(app, factCategory, FACT_TYPE.HISTORY))
	            .addSuggestions(suggestions), NO_INPUTS);
	        } else {
	          app.ask(noFactsLeft(app, factCategory, FACT_TYPE.HISTORY), NO_INPUTS);
        }
        return;
      }

      let factPrefix = 'Okay, here\'s a headquarters fact. ';
      app.data.hqFacts = Array.from(hqFacts);
      if (app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT)) {
              let image = getRandomImage(GOOGLE_IMAGES);
              app.ask(app.buildRichResponse()
                .addSimpleResponse(factPrefix)
                .addBasicCard(app.buildBasicCard(fact)
                  .setImage(image[0], image[1])
                  .addButton(LINK_OUT_TEXT, GOOGLE_LINK))
                .addSimpleResponse(NEXT_FACT_DIRECTIVE)
                .addSuggestions(CONFIRMATION_SUGGESTIONS), NO_INPUTS);
            } else {
              app.ask(factPrefix + fact + NEXT_FACT_DIRECTIVE, NO_INPUTS);
      }
      return;
    } else {
      if (app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT)) {
              app.ask(app.buildRichResponse()
                .addSimpleResponse(`Sorry, I didn't understand. I can tell you about \
      Fourth's history, or its  headquarters. Which one do you want to \
      hear about?`)
                .addSuggestions(['History', 'Headquarters']), NO_INPUTS);
            } else {
              app.ask(`Sorry, I didn't understand. I can tell you about \
      Fourth's history, or its headquarters. Which one do you want to \
      hear about?`, NO_INPUTS);
      }
    }
  }

  // Say a cat fact
  function tellCatFact (app) {
    let catFacts = app.data.catFacts
        ? new Set(app.data.catFacts) : CAT_FACTS;
    let fact = getRandomFact(catFacts);
    if (fact === null) {
      let parameters = {};
      // Add fourth-facts context to outgoing context list
      app.setContext(FOURTH_CONTEXT, DEFAULT_LIFESPAN,
        parameters);
      // Replace outgoing cat-facts context with lifespan = 0 to end it
      app.setContext(CAT_CONTEXT, END_LIFESPAN, {});
      if (app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT)) {
              app.ask(app.buildRichResponse()
                .addSimpleResponse('Looks like you\'ve heard all there is to know ' +
                  'about cats. Would you like to hear about Fourth?', NO_INPUTS)
                .addSuggestions(CONFIRMATION_SUGGESTIONS));
            } else {
              app.ask('Looks like you\'ve heard all there is to know ' +
                'about cats. Would you like to hear about Fourth?', NO_INPUTS);
      }
      return;
    }

    let factPrefix = 'Alright, here\'s a cat fact. ' +
      '<audio src="' + MEOW_SRC + '"></audio>';
    let factSpeech = '<speak>' + factPrefix + fact +
      NEXT_FACT_DIRECTIVE + '</speak>';
    app.data.catFacts = Array.from(catFacts);
    if (app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT)) {
          app.ask(app.buildRichResponse()
            .addSimpleResponse(`<speak>${factPrefix}</speak>`)
            .addBasicCard(app.buildBasicCard(fact)
              .setImage(CAT_IMAGE[0], CAT_IMAGE[1])
              .addButton(LINK_OUT_TEXT, CATS_LINK))
            .addSimpleResponse(NEXT_FACT_DIRECTIVE)
            .addSuggestions(CONFIRMATION_SUGGESTIONS), NO_INPUTS);
        } else {
          app.ask(factSpeech,
            NO_INPUTS);
    }
    return;
  }

  // Say they've heard it all about this category
  function noFactsLeft (app, currentCategory, redirectCategory) {
    let parameters = {};
    parameters[CATEGORY_ARGUMENT] = redirectCategory;
    // Replace the outgoing fourth-facts context with different parameters
    app.setContext(FOURTH_CONTEXT, DEFAULT_LIFESPAN,
        parameters);
    let response = `Looks like you've heard all there is to know \
        about the ${currentCategory} of Fourth. Would you like to hear \
        about its ${redirectCategory}? `;
    if (!app.data.catFacts || app.data.catFacts.length > 0) {
      response += 'By the way, I can tell you about cats too.';
    }
    return response;
  }

  let actionMap = new Map();
  actionMap.set(UNRECOGNIZED_DEEP_LINK, unhandledDeepLinks);
  actionMap.set(SAY_FOURTH_FACT, tellFourthFact);
  actionMap.set(SAY_CAT_FACT, tellCatFact);

  app.handleRequest(actionMap);
});
// [END fourth_facts]

if (module === require.main) {
  // [START server]
  // Start the server
  let server = expressapp.listen(process.env.PORT || 8080, function () {
    let port = server.address().port;
    console.log('App listening on port %s', port);
  });
  // [END server]
}

module.exports = expressapp;
