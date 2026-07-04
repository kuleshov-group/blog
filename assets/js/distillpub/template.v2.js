(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
}((function () { 'use strict';

  // Copyright 2018 The Distill Template Authors
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // you may not use this file except in compliance with the License.
  // You may obtain a copy of the License at
  //
  //      http://www.apache.org/licenses/LICENSE-2.0
  //
  // Unless required by applicable law or agreed to in writing, software
  // distributed under the License is distributed on an "AS IS" BASIS,
  // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  // See the License for the specific language governing permissions and
  // limitations under the License.

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  const zeroPad = n => n < 10 ? '0' + n : n;

  const RFC = function(date) {
    const day = days[date.getDay()].substring(0, 3);
    const paddedDate = zeroPad(date.getDate());
    const month = months[date.getMonth()].substring(0,3);
    const year = date.getFullYear().toString();
    const hours = date.getUTCHours().toString();
    const minutes = date.getUTCMinutes().toString();
    const seconds = date.getUTCSeconds().toString();
    return `${day}, ${paddedDate} ${month} ${year} ${hours}:${minutes}:${seconds} Z`;
  };

  const objectFromMap = function(map) {
    const object = Array.from(map).reduce((object, [key, value]) => (
      Object.assign(object, { [key]: value }) // Be careful! Maps can have non-String keys; object literals can't.
    ), {});
    return object;
  };

  const mapFromObject = function(object) {
    const map = new Map();
    for (var property in object) {
      if (object.hasOwnProperty(property)) {
        map.set(property, object[property]);
      }
    }
    return map;
  };

  class Author {

    // constructor(name='', personalURL='', affiliation='', affiliationURL='') {
    //   this.name = name; // 'Chris Olah'
    //   this.personalURL = personalURL; // 'https://colah.github.io'
    //   this.affiliation = affiliation; // 'Google Brain'
    //   this.affiliationURL = affiliationURL; // 'https://g.co/brain'
    // }

    constructor(object) {
      this.name = object.author; // 'Chris Olah'
      this.personalURL = object.authorURL; // 'https://colah.github.io'
      this.affiliation = object.affiliation; // 'Google Brain'
      this.affiliationURL = object.affiliationURL; // 'https://g.co/brain'
      this.affiliations = object.affiliations || []; // new-style affiliations
    }

    // 'Chris'
    get firstName() {
      const names = this.name.split(' ');
      return names.slice(0, names.length - 1).join(' ');
    }

    // 'Olah'
    get lastName() {
      const names = this.name.split(' ');
      return names[names.length -1];
    }
  }

  function mergeFromYMLFrontmatter(target, source) {
    target.title = source.title;
    if (source.published) {
      if (source.published instanceof Date) {
        target.publishedDate = source.published;
      } else if (source.published.constructor === String) {
        target.publishedDate = new Date(source.published);
      }
    }
    if (source.publishedDate) {
      if (source.publishedDate instanceof Date) {
        target.publishedDate = source.publishedDate;
      } else if (source.publishedDate.constructor === String) {
        target.publishedDate = new Date(source.publishedDate);
      } else {
        console.error('Don\'t know what to do with published date: ' + source.publishedDate);
      }
    }
    target.description = source.description;
    target.authors = source.authors.map( (authorObject) => new Author(authorObject));
    target.katex = source.katex;
    target.password = source.password;
    if (source.doi) {
      target.doi = source.doi;
    }
  }

  class FrontMatter {
    constructor() {
      this.title = 'unnamed article'; // 'Attention and Augmented Recurrent Neural Networks'
      this.description = ''; // 'A visual overview of neural attention...'
      this.authors = []; // Array of Author(s)

      this.bibliography = new Map();
      this.bibliographyParsed = false;
      //  {
      //    'gregor2015draw': {
      //      'title': 'DRAW: A recurrent neural network for image generation',
      //      'author': 'Gregor, Karol and Danihelka, Ivo and Graves, Alex and Rezende, Danilo Jimenez and Wierstra, Daan',
      //      'journal': 'arXiv preprint arXiv:1502.04623',
      //      'year': '2015',
      //      'url': 'https://arxiv.org/pdf/1502.04623.pdf',
      //      'type': 'article'
      //    },
      //  }

      // Citation keys should be listed in the order that they are appear in the document.
      // Each key refers to a key in the bibliography dictionary.
      this.citations = []; // [ 'gregor2015draw', 'mercier2011humans' ]
      this.citationsCollected = false;

      //
      // Assigned from posts.csv
      //

      //  publishedDate: 2016-09-08T07:00:00.000Z,
      //  tags: [ 'rnn' ],
      //  distillPath: '2016/augmented-rnns',
      //  githubPath: 'distillpub/post--augmented-rnns',
      //  doiSuffix: 1,

      //
      // Assigned from journal
      //
      this.journal = {};
      //  journal: {
      //    'title': 'Distill',
      //    'full_title': 'Distill',
      //    'abbrev_title': 'Distill',
      //    'url': 'http://distill.pub',
      //    'doi': '10.23915/distill',
      //    'publisherName': 'Distill Working Group',
      //    'publisherEmail': 'admin@distill.pub',
      //    'issn': '2476-0757',
      //    'editors': [...],
      //    'committee': [...]
      //  }
      //  volume: 1,
      //  issue: 9,

      this.katex = {};

      //
      // Assigned from publishing process
      //

      //  githubCompareUpdatesUrl: 'https://github.com/distillpub/post--augmented-rnns/compare/1596e094d8943d2dc0ea445d92071129c6419c59...3bd9209e0c24d020f87cf6152dcecc6017cbc193',
      //  updatedDate: 2017-03-21T07:13:16.000Z,
      //  doi: '10.23915/distill.00001',
      this.doi = undefined;
      this.publishedDate = undefined;
    }

    // Example:
    // title: Demo Title Attention and Augmented Recurrent Neural Networks
    // published: Jan 10, 2017
    // authors:
    // - Chris Olah:
    // - Shan Carter: http://shancarter.com
    // affiliations:
    // - Google Brain:
    // - Google Brain: http://g.co/brain

    //
    // Computed Properties
    //

    // 'http://distill.pub/2016/augmented-rnns',
    set url(value) {
      this._url = value;
    }
    get url() {
      if (this._url) {
        return this._url;
      } else if (this.distillPath && this.journal.url) {
        return this.journal.url + '/' + this.distillPath;
      } else if (this.journal.url) {
        return this.journal.url;
      }
    }

    // 'https://github.com/distillpub/post--augmented-rnns',
    get githubUrl() {
      if (this.githubPath) {
        return 'https://github.com/' + this.githubPath;
      } else {
        return undefined;
      }
    }

    // TODO resolve differences in naming of URL/Url/url.
    // 'http://distill.pub/2016/augmented-rnns/thumbnail.jpg',
    set previewURL(value) {
      this._previewURL = value;
    }
    get previewURL() {
      return this._previewURL ? this._previewURL : this.url + '/thumbnail.jpg';
    }

    // 'Thu, 08 Sep 2016 00:00:00 -0700',
    get publishedDateRFC() {
      return RFC(this.publishedDate);
    }

    // 'Thu, 08 Sep 2016 00:00:00 -0700',
    get updatedDateRFC() {
      return RFC(this.updatedDate);
    }

    // 2016,
    get publishedYear() {
      return this.publishedDate.getFullYear();
    }

    // 'Sept',
    get publishedMonth() {
      return months[this.publishedDate.getMonth()];
    }

    // 8,
    get publishedDay() {
      return this.publishedDate.getDate();
    }

    // '09',
    get publishedMonthPadded() {
      return zeroPad(this.publishedDate.getMonth() + 1);
    }

    // '08',
    get publishedDayPadded() {
      return zeroPad(this.publishedDate.getDate());
    }

    get publishedISODateOnly() {
      return this.publishedDate.toISOString().split('T')[0];
    }

    get volume() {
      const volume = this.publishedYear - 2015;
      if (volume < 1) {
        throw new Error('Invalid publish date detected during computing volume');
      }
      return volume;
    }

    get issue() {
      return this.publishedDate.getMonth() + 1;
    }

    // 'Olah & Carter',
    get concatenatedAuthors() {
      if (this.authors.length > 2) {
        return this.authors[0].lastName + ', et al.';
      } else if (this.authors.length === 2) {
        return this.authors[0].lastName + ' & ' + this.authors[1].lastName;
      } else if (this.authors.length === 1) {
        return this.authors[0].lastName;
      }
    }

    // 'Olah, Chris and Carter, Shan',
    get bibtexAuthors() {
      return this.authors.map(author => {
        return author.lastName + ', ' + author.firstName;
      }).join(' and ');
    }

    // 'olah2016attention'
    get slug() {
      let slug = '';
      if (this.authors.length) {
        slug += this.authors[0].lastName.toLowerCase();
        slug += this.publishedYear;
        slug += this.title.split(' ')[0].toLowerCase();
      }
      return slug || 'Untitled';
    }

    get bibliographyEntries() {
      return new Map(this.citations.map( citationKey => {
        const entry = this.bibliography.get(citationKey);
        return [citationKey, entry];
      }));
    }

    set bibliography(bibliography) {
      if (bibliography instanceof Map) {
        this._bibliography = bibliography;
      } else if (typeof bibliography === 'object') {
        this._bibliography = mapFromObject(bibliography);
      }
    }

    get bibliography() {
      return this._bibliography;
    }

    static fromObject(source) {
      const frontMatter = new FrontMatter();
      Object.assign(frontMatter, source);
      return frontMatter;
    }

    assignToObject(target) {
      Object.assign(target, this);
      target.bibliography = objectFromMap(this.bibliographyEntries);
      target.url = this.url;
      target.doi = this.doi;
      target.githubUrl = this.githubUrl;
      target.previewURL = this.previewURL;
      if (this.publishedDate) {
        target.volume = this.volume;
        target.issue = this.issue;
        target.publishedDateRFC = this.publishedDateRFC;
        target.publishedYear = this.publishedYear;
        target.publishedMonth = this.publishedMonth;
        target.publishedDay = this.publishedDay;
        target.publishedMonthPadded = this.publishedMonthPadded;
        target.publishedDayPadded = this.publishedDayPadded;
      }
      if (this.updatedDate) {
        target.updatedDateRFC = this.updatedDateRFC;
      }
      target.concatenatedAuthors = this.concatenatedAuthors;
      target.bibtexAuthors = this.bibtexAuthors;
      target.slug = this.slug;
    }

  }

  // Copyright 2018 The Distill Template Authors
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // you may not use this file except in compliance with the License.
  // You may obtain a copy of the License at
  //
  //      http://www.apache.org/licenses/LICENSE-2.0
  //
  // Unless required by applicable law or agreed to in writing, software
  // distributed under the License is distributed on an "AS IS" BASIS,
  // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  // See the License for the specific language governing permissions and
  // limitations under the License.

  const Mutating = (superclass) => {
    return class extends superclass {

      constructor() {
        super();

        // set up mutation observer
        const options = {childList: true, characterData: true, subtree: true};
        const observer = new MutationObserver( () => {
          observer.disconnect();
          this.renderIfPossible();
          observer.observe(this, options);
        });

        // ...and listen for changes
        observer.observe(this, options);
      }

      connectedCallback() {
        super.connectedCallback();

        this.renderIfPossible();
      }

      // potential TODO: check if this is enough for all our usecases
      // maybe provide a custom function to tell if we have enough information to render
      renderIfPossible() {
        if (this.textContent && this.root) {
          this.renderContent();
        }
      }

      renderContent() {
        console.error(`Your class ${this.constructor.name} must provide a custom renderContent() method!` );
      }

    }; // end class
  }; // end mixin function

  // Copyright 2018 The Distill Template Authors
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // you may not use this file except in compliance with the License.
  // You may obtain a copy of the License at
  //
  //      http://www.apache.org/licenses/LICENSE-2.0
  //
  // Unless required by applicable law or agreed to in writing, software
  // distributed under the License is distributed on an "AS IS" BASIS,
  // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  // See the License for the specific language governing permissions and
  // limitations under the License.

  /*global ShadyCSS*/

  const Template = (name, templateString, useShadow = true) => {

    return (superclass) => {

      const template = document.createElement('template');
      template.innerHTML = templateString;

      if (useShadow && 'ShadyCSS' in window) {
        ShadyCSS.prepareTemplate(template, name);
      }

      return class extends superclass {

        static get is() { return name; }

        constructor() {
          super();

          this.clone = document.importNode(template.content, true);
          if (useShadow) {
            this.attachShadow({mode: 'open'});
            this.shadowRoot.appendChild(this.clone);
          }
        }

        connectedCallback() {
          if (this.hasAttribute('distill-prerendered')) {
            return;
          }
          if (useShadow) {
            if ('ShadyCSS' in window) {
              ShadyCSS.styleElement(this);
            }
          } else {
            this.insertBefore(this.clone, this.firstChild);
          }
        }

        get root() {
          if (useShadow) {
            return this.shadowRoot;
          } else {
            return this;
          }
        }

        /* TODO: Are we using these? Should we even? */
        $(query) {
          return this.root.querySelector(query);
        }

        $$(query) {
          return this.root.querySelectorAll(query);
        }
      };
    };
  };

  var math = "/*\n * Copyright 2018 The Distill Template Authors\n *\n * Licensed under the Apache License, Version 2.0 (the \"License\");\n * you may not use this file except in compliance with the License.\n * You may obtain a copy of the License at\n *\n *      http://www.apache.org/licenses/LICENSE-2.0\n *\n * Unless required by applicable law or agreed to in writing, software\n * distributed under the License is distributed on an \"AS IS\" BASIS,\n * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n * See the License for the specific language governing permissions and\n * limitations under the License.\n */\n\nspan.katex-display {\n  text-align: left;\n  padding: 8px 0 8px 0;\n  margin: 0.5em 0 0.5em 1em;\n}\n\nspan.katex {\n  -webkit-font-smoothing: antialiased;\n  color: rgba(0, 0, 0, 0.8);\n  font-size: 1.18em;\n}\n";

  // Copyright 2018 The Distill Template Authors
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // you may not use this file except in compliance with the License.
  // You may obtain a copy of the License at
  //
  //      http://www.apache.org/licenses/LICENSE-2.0
  //
  // Unless required by applicable law or agreed to in writing, software
  // distributed under the License is distributed on an "AS IS" BASIS,
  // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  // See the License for the specific language governing permissions and
  // limitations under the License.

  // This is a straight concatenation of code from KaTeX's contrib folder,
  // but we aren't using some of their helpers that don't work well outside a browser environment.

  /*global katex */

  const findEndOfMath = function(delimiter, text, startIndex) {
    // Adapted from
    // https://github.com/Khan/perseus/blob/master/src/perseus-markdown.jsx
    let index = startIndex;
    let braceLevel = 0;

    const delimLength = delimiter.length;

    while (index < text.length) {
      const character = text[index];

      if (
        braceLevel <= 0 &&
        text.slice(index, index + delimLength) === delimiter
      ) {
        return index;
      } else if (character === "\\") {
        index++;
      } else if (character === "{") {
        braceLevel++;
      } else if (character === "}") {
        braceLevel--;
      }

      index++;
    }

    return -1;
  };

  const splitAtDelimiters = function(startData, leftDelim, rightDelim, display) {
    const finalData = [];

    for (let i = 0; i < startData.length; i++) {
      if (startData[i].type === "text") {
        const text = startData[i].data;

        let lookingForLeft = true;
        let currIndex = 0;
        let nextIndex;

        nextIndex = text.indexOf(leftDelim);
        if (nextIndex !== -1) {
          currIndex = nextIndex;
          finalData.push({
            type: "text",
            data: text.slice(0, currIndex)
          });
          lookingForLeft = false;
        }

        while (true) {
          // eslint-disable-line no-constant-condition
          if (lookingForLeft) {
            nextIndex = text.indexOf(leftDelim, currIndex);
            if (nextIndex === -1) {
              break;
            }

            finalData.push({
              type: "text",
              data: text.slice(currIndex, nextIndex)
            });

            currIndex = nextIndex;
          } else {
            nextIndex = findEndOfMath(
              rightDelim,
              text,
              currIndex + leftDelim.length
            );
            if (nextIndex === -1) {
              break;
            }

            finalData.push({
              type: "math",
              data: text.slice(currIndex + leftDelim.length, nextIndex),
              rawData: text.slice(currIndex, nextIndex + rightDelim.length),
              display: display
            });

            currIndex = nextIndex + rightDelim.length;
          }

          lookingForLeft = !lookingForLeft;
        }

        finalData.push({
          type: "text",
          data: text.slice(currIndex)
        });
      } else {
        finalData.push(startData[i]);
      }
    }

    return finalData;
  };

  const splitWithDelimiters = function(text, delimiters) {
    let data = [{ type: "text", data: text }];
    for (let i = 0; i < delimiters.length; i++) {
      const delimiter = delimiters[i];
      data = splitAtDelimiters(
        data,
        delimiter.left,
        delimiter.right,
        delimiter.display || false
      );
    }
    return data;
  };

  /* Note: optionsCopy is mutated by this method. If it is ever exposed in the
   * API, we should copy it before mutating.
   */
  const renderMathInText = function(text, optionsCopy) {
    const data = splitWithDelimiters(text, optionsCopy.delimiters);
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < data.length; i++) {
      if (data[i].type === "text") {
        fragment.appendChild(document.createTextNode(data[i].data));
      } else {
        const tag = document.createElement("d-math");
        const math = data[i].data;
        // Override any display mode defined in the settings with that
        // defined by the text itself
        optionsCopy.displayMode = data[i].display;
        try {
          tag.textContent = math;
          if (optionsCopy.displayMode) {
            tag.setAttribute("block", "");
          }
        } catch (e) {
          if (!(e instanceof katex.ParseError)) {
            throw e;
          }
          optionsCopy.errorCallback(
            "KaTeX auto-render: Failed to parse `" + data[i].data + "` with ",
            e
          );
          fragment.appendChild(document.createTextNode(data[i].rawData));
          continue;
        }
        fragment.appendChild(tag);
      }
    }

    return fragment;
  };

  const renderElem = function(elem, optionsCopy) {
    for (let i = 0; i < elem.childNodes.length; i++) {
      const childNode = elem.childNodes[i];
      if (childNode.nodeType === 3) {
        // Text node
        const text = childNode.textContent;
        if (optionsCopy.mightHaveMath(text)) {
          const frag = renderMathInText(text, optionsCopy);
          i += frag.childNodes.length - 1;
          elem.replaceChild(frag, childNode);
        }
      } else if (childNode.nodeType === 1) {
        // Element node
        const shouldRender =
          optionsCopy.ignoredTags.indexOf(childNode.nodeName.toLowerCase()) ===
          -1;

        if (shouldRender) {
          renderElem(childNode, optionsCopy);
        }
      }
      // Otherwise, it's something else, and ignore it.
    }
  };

  const defaultAutoRenderOptions = {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false }
      // LaTeX uses this, but it ruins the display of normal `$` in text:
      // {left: '$', right: '$', display: false},
    ],

    ignoredTags: [
      "script",
      "noscript",
      "style",
      "textarea",
      "pre",
      "code",
      "svg"
    ],

    errorCallback: function(msg, err) {
      console.error(msg, err);
    }
  };

  const renderMathInElement = function(elem, options) {
    if (!elem) {
      throw new Error("No element provided to render");
    }

    const optionsCopy = Object.assign({}, defaultAutoRenderOptions, options);
    const delimiterStrings = optionsCopy.delimiters.flatMap(d => [
      d.left,
      d.right
    ]);
    const mightHaveMath = text =>
      delimiterStrings.some(d => text.indexOf(d) !== -1);
    optionsCopy.mightHaveMath = mightHaveMath;
    renderElem(elem, optionsCopy);
  };

  // Copyright 2018 The Distill Template Authors

  const katexJSURL = 'https://distill.pub/third-party/katex/katex.min.js';
  const katexCSSTag = '<link rel="stylesheet" href="https://distill.pub/third-party/katex/katex.min.css" crossorigin="anonymous">';

  const T = Template('d-math', `
${katexCSSTag}
<style>

:host {
  display: inline-block;
  contain: style;
}

:host([block]) {
  display: block;
}

${math}
</style>
<span id='katex-container'></span>
`);

  // DMath, not Math, because that would conflict with the JS built-in
  class DMath extends Mutating(T(HTMLElement)) {

    static set katexOptions(options) {
      DMath._katexOptions = options;
      if (DMath.katexOptions.delimiters) {
        if (!DMath.katexAdded) {
          DMath.addKatex();
        } else {
          DMath.katexLoadedCallback();
        }
      }
    }

    static get katexOptions() {
      if (!DMath._katexOptions) {
        DMath._katexOptions = {
          delimiters: [ { 'left':'$$', 'right':'$$', 'display': false } ]
        };
      }
      return DMath._katexOptions;
    }

    static katexLoadedCallback() {
      // render all d-math tags
      const mathTags = document.querySelectorAll('d-math');
      for (const mathTag of mathTags) {
        mathTag.renderContent();
      }
      // transform inline delimited math to d-math tags
      if (DMath.katexOptions.delimiters) {
        renderMathInElement(document.body, DMath.katexOptions);
      }
    }

    static addKatex() {
      // css tag can use this convenience function
      document.head.insertAdjacentHTML('beforeend', katexCSSTag);
      // script tag has to be created to work properly
      const scriptTag = document.createElement('script');
      scriptTag.src = katexJSURL;
      scriptTag.async = true;
      scriptTag.onload = DMath.katexLoadedCallback;
      scriptTag.crossorigin = 'anonymous';
      document.head.appendChild(scriptTag);

      DMath.katexAdded = true;
    }

    get options() {
      const localOptions = { displayMode: this.hasAttribute('block') };
      return Object.assign(localOptions, DMath.katexOptions);
    }

    connectedCallback() {
      super.connectedCallback();
      if (!DMath.katexAdded) {
        DMath.addKatex();
      }
    }

    renderContent() {
      if (typeof katex !== 'undefined') {
        const container = this.root.querySelector('#katex-container');
        katex.render(this.textContent, container, this.options);
      }
    }

  }

  DMath.katexAdded = false;
  DMath.inlineMathRendered = false;
  window.DMath = DMath; // TODO: check if this can be removed, or if we should expose a distill global

  // Copyright 2018 The Distill Template Authors
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // you may not use this file except in compliance with the License.
  // You may obtain a copy of the License at
  //
  //      http://www.apache.org/licenses/LICENSE-2.0
  //
  // Unless required by applicable law or agreed to in writing, software
  // distributed under the License is distributed on an "AS IS" BASIS,
  // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  // See the License for the specific language governing permissions and
  // limitations under the License.

  function collect_citations(dom = document) {
    const citations = new Set();
    const citeTags = dom.querySelectorAll("d-cite");
    for (const tag of citeTags) {
      const keyString = tag.getAttribute("key") || tag.getAttribute("bibtex-key");
      const keys = keyString.split(",").map(k => k.trim());
      for (const key of keys) {
        citations.add(key);
      }
    }
    return [...citations];
  }

  function author_string(ent, template, sep, finalSep) {
    if (ent.author == null) {
      return "";
    }
    var names = ent.author.split(" and ");
    let name_strings = names.map(name => {
      name = name.trim();
      if (name.indexOf(",") != -1) {
        var last = name.split(",")[0].trim();
        var firsts = name.split(",")[1];
      } else if (name.indexOf(" ") != -1) {
        var last = name
          .split(" ")
          .slice(-1)[0]
          .trim();
        var firsts = name
          .split(" ")
          .slice(0, -1)
          .join(" ");
      } else {
        var last = name.trim();
      }
      var initials = "";
      if (firsts != undefined) {
        initials = firsts
          .trim()
          .split(" ")
          .map(s => s.trim()[0]);
        initials = initials.join(".") + ".";
      }
      return template
        .replace("${F}", firsts)
        .replace("${L}", last)
        .replace("${I}", initials)
        .trim(); // in case one of first or last was empty
    });
    if (names.length > 1) {
      var str = name_strings.slice(0, names.length - 1).join(sep);
      str += (finalSep || sep) + name_strings[names.length - 1];
      return str;
    } else {
      return name_strings[0];
    }
  }

  function venue_string(ent) {
    var cite = ent.journal || ent.booktitle || "";
    if ("volume" in ent) {
      var issue = ent.issue || ent.number;
      issue = issue != undefined ? "(" + issue + ")" : "";
      cite += ", Vol " + ent.volume + issue;
    }
    if ("pages" in ent) {
      cite += ", pp. " + ent.pages;
    }
    if (cite != "") cite += ". ";
    if ("publisher" in ent) {
      cite += ent.publisher;
      if (cite[cite.length - 1] != ".") cite += ".";
    }
    return cite;
  }

  function link_string(ent) {
    if ("url" in ent) {
      var url = ent.url;
      var arxiv_match = /arxiv\.org\/abs\/([0-9\.]*)/.exec(url);
      if (arxiv_match != null) {
        url = `http://arxiv.org/pdf/${arxiv_match[1]}.pdf`;
      }

      if (url.slice(-4) == ".pdf") {
        var label = "PDF";
      } else if (url.slice(-5) == ".html") {
        var label = "HTML";
      }
      return ` &ensp;<a href="${url}">[${label || "link"}]</a>`;
    } /* else if ("doi" in ent){
      return ` &ensp;<a href="https://doi.org/${ent.doi}" >[DOI]</a>`;
    }*/ else {
      return "";
    }
  }
  function doi_string(ent, new_line) {
    if ("doi" in ent) {
      return `${new_line ? "<br>" : ""} <a href="https://doi.org/${
      ent.doi
    }" style="text-decoration:inherit;">DOI: ${ent.doi}</a>`;
    } else {
      return "";
    }
  }

  function title_string(ent) {
    return '<span class="title">' + ent.title + "</span> ";
  }

  function bibliography_cite(ent, fancy) {
    if (ent) {
      var cite = title_string(ent);
      cite += link_string(ent) + "<br>";
      if (ent.author) {
        cite += author_string(ent, "${L}, ${I}", ", ", " and ");
        if (ent.year || ent.date) {
          cite += ", ";
        }
      }
      if (ent.year || ent.date) {
        cite += (ent.year || ent.date) + ". ";
      } else {
        cite += ". ";
      }
      cite += venue_string(ent);
      cite += doi_string(ent);
      return cite;
      /*var cite =  author_string(ent, "${L}, ${I}", ", ", " and ");
      if (ent.year || ent.date){
        cite += ", " + (ent.year || ent.date) + ". "
      } else {
        cite += ". "
      }
      cite += "<b>" + ent.title + "</b>. ";
      cite += venue_string(ent);
      cite += doi_string(ent);
      cite += link_string(ent);
      return cite*/
    } else {
      return "?";
    }
  }

  function hover_cite(ent) {
    if (ent) {
      var cite = "";
      cite += "<strong>" + ent.title + "</strong>";
      cite += link_string(ent);
      cite += "<br>";

      var a_str = author_string(ent, "${I} ${L}", ", ") + ".";
      var v_str =
        venue_string(ent).trim() + " " + ent.year + ". " + doi_string(ent, true);

      if ((a_str + v_str).length < Math.min(40, ent.title.length)) {
        cite += a_str + " " + v_str;
      } else {
        cite += a_str + "<br>" + v_str;
      }
      return cite;
    } else {
      return "?";
    }
  }

  function domContentLoaded() {
    return ['interactive', 'complete'].indexOf(document.readyState) !== -1;
  }

  // Copyright 2018 The Distill Template Authors
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // you may not use this file except in compliance with the License.
  // You may obtain a copy of the License at
  //
  //      http://www.apache.org/licenses/LICENSE-2.0
  //
  // Unless required by applicable law or agreed to in writing, software
  // distributed under the License is distributed on an "AS IS" BASIS,
  // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  // See the License for the specific language governing permissions and
  // limitations under the License.

  function _moveLegacyAffiliationFormatIntoArray(frontMatter) {
    // authors used to have propoerties "affiliation" and "affiliationURL".
    // We now encourage using an array for affiliations containing objects with
    // properties "name" and "url".
    for (let author of frontMatter.authors) {
      const hasOldStyle = Boolean(author.affiliation);
      const hasNewStyle = Boolean(author.affiliations);
      if (!hasOldStyle) continue;
      if (hasNewStyle) {
        console.warn(`Author ${author.author} has both old-style ("affiliation" & "affiliationURL") and new style ("affiliations") affiliation information!`);
      } else {
        let newAffiliation = {
          "name": author.affiliation
        };
        if (author.affiliationURL) newAffiliation.url = author.affiliationURL;
        author.affiliations = [newAffiliation];
      }
    }
    return frontMatter
  }

  function parseFrontmatter(element) {
    const scriptTag = element.firstElementChild;
    if (scriptTag) {
      const type = scriptTag.getAttribute('type');
      if (type.split('/')[1] == 'json') {
        const content = scriptTag.textContent;
        const parsed = JSON.parse(content);
        return _moveLegacyAffiliationFormatIntoArray(parsed);
      } else {
        console.error('Distill only supports JSON frontmatter tags anymore; no more YAML.');
      }
    } else {
      console.error('You added a frontmatter tag but did not provide a script tag with front matter data in it. Please take a look at our templates.');
    }
    return {};
  }

  class FrontMatter$1 extends HTMLElement {

    static get is() { return 'd-front-matter'; }

    constructor() {
      super();

      const options = {childList: true, characterData: true, subtree: true};
      const observer = new MutationObserver( (entries) => {
        for (const entry of entries) {
          if (entry.target.nodeName === 'SCRIPT' || entry.type === 'characterData') {
            const data = parseFrontmatter(this);
            this.notify(data);
          }
        }
      });
      observer.observe(this, options);
    }

    notify(data) {
      const options = { detail: data, bubbles: true };
      const event = new CustomEvent('onFrontMatterChanged', options);
      document.dispatchEvent(event);
    }

  }

  // Copyright 2018 The Distill Template Authors
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // you may not use this file except in compliance with the License.
  // You may obtain a copy of the License at
  //
  //      http://www.apache.org/licenses/LICENSE-2.0
  //
  // Unless required by applicable law or agreed to in writing, software
  // distributed under the License is distributed on an "AS IS" BASIS,
  // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  // See the License for the specific language governing permissions and
  // limitations under the License.

  // no appendix -> add appendix
  // title in front, no h1 -> add it
  // no title in front, h1 -> read and put into frontMatter
  // footnote -> footnote list
  // break up bib
  // if citation, no bib-list -> add citation-list

  // if authors, no byline -> add byline

  function optionalComponents(dom, data) {
    const body = dom.body;
    const article = body.querySelector('d-article');

    // If we don't have an article tag, something weird is going on—giving up.
    if (!article) {
      console.warn('No d-article tag found; skipping adding optional components!');
      return;
    }

    let byline = dom.querySelector('d-byline');
    if (!byline) {
      if (data.authors) {
        byline = dom.createElement('d-byline');
        body.insertBefore(byline, article);
      } else {
        console.warn('No authors found in front matter; please add them before submission!');
      }
    }

    let title = dom.querySelector('d-title');
    if (!title) {
      title = dom.createElement('d-title');
      body.insertBefore(title, byline);
    }

    let h1 = title.querySelector('h1');
    if (!h1) {
      h1 = dom.createElement('h1');
      h1.textContent = data.title;
      title.insertBefore(h1, title.firstChild);
    }

    const hasPassword = typeof data.password !== 'undefined';
    let interstitial = body.querySelector('d-interstitial');
    if (hasPassword && !interstitial) {
      const inBrowser = typeof window !== 'undefined';
      const onLocalhost = inBrowser && window.location.hostname.includes('localhost');
      if (!inBrowser || !onLocalhost) {
        interstitial = dom.createElement('d-interstitial');
        interstitial.password = data.password;
        body.insertBefore(interstitial, body.firstChild);
      }
    } else if (!hasPassword && interstitial) {
      interstitial.parentElement.removeChild(this);
    }

    let appendix = dom.querySelector('d-appendix');
    if (!appendix) {
      appendix = dom.createElement('d-appendix');
      dom.body.appendChild(appendix);
    }

    let footnoteList = dom.querySelector('d-footnote-list');
    if (!footnoteList) {
      footnoteList = dom.createElement('d-footnote-list');
      appendix.appendChild(footnoteList);
    }

    let citationList = dom.querySelector('d-citation-list');
    if (!citationList) {
      citationList = dom.createElement('d-citation-list');
      appendix.appendChild(citationList);
    }

  }

  // Copyright 2018 The Distill Template Authors

  const frontMatter = new FrontMatter();

  const Controller = {
    frontMatter: frontMatter,
    waitingOn: {
      bibliography: [],
      citations: []
    },
    listeners: {
      onCiteKeyCreated(event) {
        const [citeTag, keys] = event.detail;

        // ensure we have citations
        if (!frontMatter.citationsCollected) {
          // console.debug('onCiteKeyCreated, but unresolved dependency ("citations"). Enqueing.');
          Controller.waitingOn.citations.push(() =>
            Controller.listeners.onCiteKeyCreated(event)
          );
          return;
        }

        // ensure we have a loaded bibliography
        if (!frontMatter.bibliographyParsed) {
          // console.debug('onCiteKeyCreated, but unresolved dependency ("bibliography"). Enqueing.');
          Controller.waitingOn.bibliography.push(() =>
            Controller.listeners.onCiteKeyCreated(event)
          );
          return;
        }

        const numbers = keys.map(key => frontMatter.citations.indexOf(key));
        citeTag.numbers = numbers;
        const entries = keys.map(key => frontMatter.bibliography.get(key));
        citeTag.entries = entries;
      },

      onCiteKeyChanged() {
        // const [citeTag, keys] = event.detail;

        // update citations
        frontMatter.citations = collect_citations();
        frontMatter.citationsCollected = true;
        for (const waitingCallback of Controller.waitingOn.citations.slice()) {
          waitingCallback();
        }

        // update bibliography
        const citationListTag = document.querySelector("d-citation-list");
        const bibliographyEntries = new Map(
          frontMatter.citations.map(citationKey => {
            return [citationKey, frontMatter.bibliography.get(citationKey)];
          })
        );
        citationListTag.citations = bibliographyEntries;

        const citeTags = document.querySelectorAll("d-cite");
        for (const citeTag of citeTags) {
          console.log(citeTag);
          const keys = citeTag.keys;
          const numbers = keys.map(key => frontMatter.citations.indexOf(key));
          citeTag.numbers = numbers;
          const entries = keys.map(key => frontMatter.bibliography.get(key));
          citeTag.entries = entries;
        }
      },

      onCiteKeyRemoved(event) {
        Controller.listeners.onCiteKeyChanged(event);
      },

      onBibliographyChanged(event) {
        const citationListTag = document.querySelector("d-citation-list");

        const bibliography = event.detail;

        frontMatter.bibliography = bibliography;
        frontMatter.bibliographyParsed = true;
        for (const waitingCallback of Controller.waitingOn.bibliography.slice()) {
          waitingCallback();
        }

        // ensure we have citations
        if (!frontMatter.citationsCollected) {
          Controller.waitingOn.citations.push(function() {
            Controller.listeners.onBibliographyChanged({
              target: event.target,
              detail: event.detail
            });
          });
          return;
        }

        if (citationListTag.hasAttribute("distill-prerendered")) {
          console.debug("Citation list was prerendered; not updating it.");
        } else {
          const entries = new Map(
            frontMatter.citations.map(citationKey => {
              return [citationKey, frontMatter.bibliography.get(citationKey)];
            })
          );
          citationListTag.citations = entries;
        }
      },

      onFootnoteChanged() {
        // const footnote = event.detail;
        //TODO: optimize to only update current footnote
        const footnotesList = document.querySelector("d-footnote-list");
        if (footnotesList) {
          const footnotes = document.querySelectorAll("d-footnote");
          footnotesList.footnotes = footnotes;
        }
      },

      onFrontMatterChanged(event) {
        const data = event.detail;
        mergeFromYMLFrontmatter(frontMatter, data);

        const interstitial = document.querySelector("d-interstitial");
        if (interstitial) {
          if (typeof frontMatter.password !== "undefined") {
            interstitial.password = frontMatter.password;
          } else {
            interstitial.parentElement.removeChild(interstitial);
          }
        }

        const prerendered = document.body.hasAttribute("distill-prerendered");
        if (!prerendered && domContentLoaded()) {
          optionalComponents(document, frontMatter);

          const appendix = document.querySelector("distill-appendix");
          if (appendix) {
            appendix.frontMatter = frontMatter;
          }

          const byline = document.querySelector("d-byline");
          if (byline) {
            byline.frontMatter = frontMatter;
          }

          if (data.katex) {
            DMath.katexOptions = data.katex;
          }
        }
      },

      DOMContentLoaded() {
        if (Controller.loaded) {
          console.warn(
            "Controller received DOMContentLoaded but was already loaded!"
          );
          return;
        } else if (!domContentLoaded()) {
          console.warn(
            "Controller received DOMContentLoaded at document.readyState: " +
              document.readyState +
              "!"
          );
          return;
        } else {
          Controller.loaded = true;
          console.debug("Runlevel 4: Controller running DOMContentLoaded");
        }

        const frontMatterTag = document.querySelector("d-front-matter");
        if (frontMatterTag) {
          const data = parseFrontmatter(frontMatterTag);
          Controller.listeners.onFrontMatterChanged({ detail: data });
        }

        // Resolving "citations" dependency due to initial DOM load
        frontMatter.citations = collect_citations();
        frontMatter.citationsCollected = true;
        for (const waitingCallback of Controller.waitingOn.citations.slice()) {
          waitingCallback();
        }

        if (frontMatter.bibliographyParsed) {
          for (const waitingCallback of Controller.waitingOn.bibliography.slice()) {
            waitingCallback();
          }
        }

        const footnotesList = document.querySelector("d-footnote-list");
        if (footnotesList) {
          const footnotes = document.querySelectorAll("d-footnote");
          footnotesList.footnotes = footnotes;
        }
      }
    } // listeners
  }; // Controller

  var base = "/*\n * Copyright 2018 The Distill Template Authors\n *\n * Licensed under the Apache License, Version 2.0 (the \"License\");\n * you may not use this file except in compliance with the License.\n * You may obtain a copy of the License at\n *\n *      http://www.apache.org/licenses/LICENSE-2.0\n *\n * Unless required by applicable law or agreed to in writing, software\n * distributed under the License is distributed on an \"AS IS\" BASIS,\n * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n * See the License for the specific language governing permissions and\n * limitations under the License.\n */\n\nhtml {\n  font-size: 14px;\n\tline-height: 1.6em;\n  /* font-family: \"Libre Franklin\", \"Helvetica Neue\", sans-serif; */\n  font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Fira Sans\", \"Droid Sans\", \"Helvetica Neue\", Arial, sans-serif;\n  /*, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\";*/\n  text-size-adjust: 100%;\n  -ms-text-size-adjust: 100%;\n  -webkit-text-size-adjust: 100%;\n}\n\n@media(min-width: 768px) {\n  html {\n    font-size: 16px;\n  }\n}\n\nbody {\n  margin: 0;\n}\n\na {\n  color: #004276;\n}\n\nfigure {\n  margin: 0;\n}\n\ntable {\n\tborder-collapse: collapse;\n\tborder-spacing: 0;\n}\n\ntable th {\n\ttext-align: left;\n}\n\ntable thead {\n  border-bottom: 1px solid rgba(0, 0, 0, 0.05);\n}\n\ntable thead th {\n  padding-bottom: 0.5em;\n}\n\ntable tbody :first-child td {\n  padding-top: 0.5em;\n}\n\npre {\n  overflow: auto;\n  max-width: 100%;\n}\n\np {\n  margin-top: 0;\n  margin-bottom: 1em;\n}\n\nsup, sub {\n  vertical-align: baseline;\n  position: relative;\n  top: -0.4em;\n  line-height: 1em;\n}\n\nsub {\n  top: 0.4em;\n}\n\n.kicker,\n.marker {\n  font-size: 15px;\n  font-weight: 600;\n  color: rgba(0, 0, 0, 0.5);\n}\n\n\n/* Headline */\n\n@media(min-width: 1024px) {\n  d-title h1 span {\n    display: block;\n  }\n}\n\n/* Figure */\n\nfigure {\n  position: relative;\n  margin-bottom: 2.5em;\n  margin-top: 1.5em;\n}\n\nfigcaption+figure {\n\n}\n\nfigure img {\n  width: 100%;\n}\n\nfigure svg text,\nfigure svg tspan {\n}\n\nfigcaption,\n.figcaption {\n  color: rgba(0, 0, 0, 0.6);\n  font-size: 12px;\n  line-height: 1.5em;\n}\n\n@media(min-width: 1024px) {\nfigcaption,\n.figcaption {\n    font-size: 13px;\n  }\n}\n\nfigure.external img {\n  background: white;\n  border: 1px solid rgba(0, 0, 0, 0.1);\n  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.1);\n  padding: 18px;\n  box-sizing: border-box;\n}\n\nfigcaption a {\n  color: rgba(0, 0, 0, 0.6);\n}\n\nfigcaption b,\nfigcaption strong, {\n  font-weight: 600;\n  color: rgba(0, 0, 0, 1.0);\n}\n";

  var layout = "/*\n * Copyright 2018 The Distill Template Authors\n *\n * Licensed under the Apache License, Version 2.0 (the \"License\");\n * you may not use this file except in compliance with the License.\n * You may obtain a copy of the License at\n *\n *      http://www.apache.org/licenses/LICENSE-2.0\n *\n * Unless required by applicable law or agreed to in writing, software\n * distributed under the License is distributed on an \"AS IS\" BASIS,\n * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n * See the License for the specific language governing permissions and\n * limitations under the License.\n */\n\n@supports not (display: grid) {\n  .base-grid,\n  distill-header,\n  d-title,\n  d-abstract,\n  d-article,\n  d-appendix,\n  distill-appendix,\n  d-byline,\n  d-footnote-list,\n  d-citation-list,\n  distill-footer {\n    display: block;\n    padding: 8px;\n  }\n}\n\n.base-grid,\ndistill-header,\nd-title,\nd-abstract,\nd-article,\nd-appendix,\ndistill-appendix,\nd-byline,\nd-footnote-list,\nd-citation-list,\ndistill-footer {\n  display: grid;\n  justify-items: stretch;\n  grid-template-columns: [screen-start] 8px [page-start kicker-start text-start gutter-start middle-start] 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr [text-end page-end gutter-end kicker-end middle-end] 8px [screen-end];\n  grid-column-gap: 8px;\n}\n\n.grid {\n  display: grid;\n  grid-column-gap: 8px;\n}\n\n@media(min-width: 768px) {\n  .base-grid,\n  distill-header,\n  d-title,\n  d-abstract,\n  d-article,\n  d-appendix,\n  distill-appendix,\n  d-byline,\n  d-footnote-list,\n  d-citation-list,\n  distill-footer {\n    grid-template-columns: [screen-start] 1fr [page-start kicker-start middle-start text-start] 45px 45px 45px 45px 45px 45px 45px 45px [ kicker-end text-end gutter-start] 45px [middle-end] 45px [page-end gutter-end] 1fr [screen-end];\n    grid-column-gap: 16px;\n  }\n\n  .grid {\n    grid-column-gap: 16px;\n  }\n}\n\n@media(min-width: 1000px) {\n  .base-grid,\n  distill-header,\n  d-title,\n  d-abstract,\n  d-article,\n  d-appendix,\n  distill-appendix,\n  d-byline,\n  d-footnote-list,\n  d-citation-list,\n  distill-footer {\n    grid-template-columns: [screen-start] 1fr [page-start kicker-start] 50px [middle-start] 50px [text-start kicker-end] 50px 50px 50px 50px 50px 50px 50px 50px [text-end gutter-start] 50px [middle-end] 50px [page-end gutter-end] 1fr [screen-end];\n    grid-column-gap: 16px;\n  }\n\n  .grid {\n    grid-column-gap: 16px;\n  }\n}\n\n@media(min-width: 1180px) {\n  .base-grid,\n  distill-header,\n  d-title,\n  d-abstract,\n  d-article,\n  d-appendix,\n  distill-appendix,\n  d-byline,\n  d-footnote-list,\n  d-citation-list,\n  distill-footer {\n    grid-template-columns: [screen-start] 1fr [page-start kicker-start] 60px [middle-start] 60px [text-start kicker-end] 60px 60px 60px 60px 60px 60px 60px 60px [text-end gutter-start] 60px [middle-end] 60px [page-end gutter-end] 1fr [screen-end];\n    grid-column-gap: 32px;\n  }\n\n  .grid {\n    grid-column-gap: 32px;\n  }\n}\n\n\n\n\n.base-grid {\n  grid-column: screen;\n}\n\n/* .l-body,\nd-article > *  {\n  grid-column: text;\n}\n\n.l-page,\nd-title > *,\nd-figure {\n  grid-column: page;\n} */\n\n.l-gutter {\n  grid-column: gutter;\n}\n\n.l-text,\n.l-body {\n  grid-column: text;\n}\n\n.l-page {\n  grid-column: page;\n}\n\n.l-body-outset {\n  grid-column: middle;\n}\n\n.l-page-outset {\n  grid-column: page;\n}\n\n.l-screen {\n  grid-column: screen;\n}\n\n.l-screen-inset {\n  grid-column: screen;\n  padding-left: 16px;\n  padding-left: 16px;\n}\n\n\n/* Aside */\n\nd-article aside {\n  grid-column: gutter;\n  font-size: 12px;\n  line-height: 1.6em;\n  color: rgba(0, 0, 0, 0.6)\n}\n\n@media(min-width: 768px) {\n  aside {\n    grid-column: gutter;\n  }\n\n  .side {\n    grid-column: gutter;\n  }\n}\n";

  var print = "/*\n * Copyright 2018 The Distill Template Authors\n *\n * Licensed under the Apache License, Version 2.0 (the \"License\");\n * you may not use this file except in compliance with the License.\n * You may obtain a copy of the License at\n *\n *      http://www.apache.org/licenses/LICENSE-2.0\n *\n * Unless required by applicable law or agreed to in writing, software\n * distributed under the License is distributed on an \"AS IS\" BASIS,\n * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n * See the License for the specific language governing permissions and\n * limitations under the License.\n */\n\n@media print {\n\n  @page {\n    size: 8in 11in;\n    @bottom-right {\n      content: counter(page) \" of \" counter(pages);\n    }\n  }\n\n  html {\n    /* no general margins -- CSS Grid takes care of those */\n  }\n\n  p, code {\n    page-break-inside: avoid;\n  }\n\n  h2, h3 {\n    page-break-after: avoid;\n  }\n\n  d-header {\n    visibility: hidden;\n  }\n\n  d-footer {\n    display: none!important;\n  }\n\n}\n";

  var byline = "/*\n * Copyright 2018 The Distill Template Authors\n *\n * Licensed under the Apache License, Version 2.0 (the \"License\");\n * you may not use this file except in compliance with the License.\n * You may obtain a copy of the License at\n *\n *      http://www.apache.org/licenses/LICENSE-2.0\n *\n * Unless required by applicable law or agreed to in writing, software\n * distributed under the License is distributed on an \"AS IS\" BASIS,\n * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n * See the License for the specific language governing permissions and\n * limitations under the License.\n */\n\nd-byline {\n  contain: style;\n  overflow: hidden;\n  border-top: 1px solid rgba(0, 0, 0, 0.1);\n  font-size: 0.8rem;\n  line-height: 1.8em;\n  padding: 1.5rem 0;\n  min-height: 1.8em;\n}\n\n\nd-byline .byline {\n  grid-template-columns: 1fr 1fr;\n  grid-column: text;\n}\n\n@media(min-width: 768px) {\n  d-byline .byline {\n    grid-template-columns: 1fr 1fr 1fr 1fr;\n  }\n}\n\nd-byline .authors-affiliations {\n  grid-column-end: span 2;\n  grid-template-columns: 1fr 1fr;\n  margin-bottom: 1em;\n}\n\n@media(min-width: 768px) {\n  d-byline .authors-affiliations {\n    margin-bottom: 0;\n  }\n}\n\nd-byline h3 {\n  font-size: 0.6rem;\n  font-weight: 400;\n  color: rgba(0, 0, 0, 0.5);\n  margin: 0;\n  text-transform: uppercase;\n}\n\nd-byline p {\n  margin: 0;\n}\n\nd-byline a,\nd-article d-byline a {\n  color: rgba(0, 0, 0, 0.8);\n  text-decoration: none;\n  border-bottom: none;\n}\n\nd-article d-byline a:hover {\n  text-decoration: underline;\n  border-bottom: none;\n}\n\nd-byline p.author {\n  font-weight: 500;\n}\n\nd-byline .affiliations {\n\n}\n";

  var article = "/*\n * Copyright 2018 The Distill Template Authors\n *\n * Licensed under the Apache License, Version 2.0 (the \"License\");\n * you may not use this file except in compliance with the License.\n * You may obtain a copy of the License at\n *\n *      http://www.apache.org/licenses/LICENSE-2.0\n *\n * Unless required by applicable law or agreed to in writing, software\n * distributed under the License is distributed on an \"AS IS\" BASIS,\n * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n * See the License for the specific language governing permissions and\n * limitations under the License.\n */\n\nd-article {\n  contain: layout style;\n  overflow-x: hidden;\n  border-top: 1px solid rgba(0, 0, 0, 0.1);\n  padding-top: 2rem;\n  color: rgba(0, 0, 0, 0.8);\n}\n\nd-article > * {\n  grid-column: text;\n}\n\n@media(min-width: 768px) {\n  d-article {\n    font-size: 16px;\n  }\n}\n\n@media(min-width: 1024px) {\n  d-article {\n    font-size: 1.06rem;\n    line-height: 1.7em;\n  }\n}\n\n\n/* H2 */\n\n\nd-article .marker {\n  text-decoration: none;\n  border: none;\n  counter-reset: section;\n  grid-column: kicker;\n  line-height: 1.7em;\n}\n\nd-article .marker:hover {\n  border: none;\n}\n\nd-article .marker span {\n  padding: 0 3px 4px;\n  border-bottom: 1px solid rgba(0, 0, 0, 0.2);\n  position: relative;\n  top: 4px;\n}\n\nd-article .marker:hover span {\n  color: rgba(0, 0, 0, 0.7);\n  border-bottom: 1px solid rgba(0, 0, 0, 0.7);\n}\n\nd-article h2 {\n  font-weight: 600;\n  font-size: 24px;\n  line-height: 1.25em;\n  margin: 2rem 0 1.5rem 0;\n  border-bottom: 1px solid rgba(0, 0, 0, 0.1);\n  padding-bottom: 1rem;\n}\n\n@media(min-width: 1024px) {\n  d-article h2 {\n    font-size: 36px;\n  }\n}\n\n/* H3 */\n\nd-article h3 {\n  font-weight: 700;\n  font-size: 18px;\n  line-height: 1.4em;\n  margin-bottom: 1em;\n  margin-top: 2em;\n}\n\n@media(min-width: 1024px) {\n  d-article h3 {\n    font-size: 20px;\n  }\n}\n\n/* H4 */\n\nd-article h4 {\n  font-weight: 600;\n  text-transform: uppercase;\n  font-size: 14px;\n  line-height: 1.4em;\n}\n\nd-article a {\n  color: inherit;\n}\n\nd-article p,\nd-article ul,\nd-article ol,\nd-article blockquote {\n  margin-top: 0;\n  margin-bottom: 1em;\n  margin-left: 0;\n  margin-right: 0;\n}\n\nd-article blockquote {\n  border-left: 2px solid rgba(0, 0, 0, 0.2);\n  padding-left: 2em;\n  font-style: italic;\n  color: rgba(0, 0, 0, 0.6);\n}\n\nd-article a {\n  border-bottom: 1px solid rgba(0, 0, 0, 0.4);\n  text-decoration: none;\n}\n\nd-article a:hover {\n  border-bottom: 1px solid rgba(0, 0, 0, 0.8);\n}\n\nd-article .link {\n  text-decoration: underline;\n  cursor: pointer;\n}\n\nd-article ul,\nd-article ol {\n  padding-left: 24px;\n}\n\nd-article li {\n  margin-bottom: 1em;\n  margin-left: 0;\n  padding-left: 0;\n}\n\nd-article li:last-child {\n  margin-bottom: 0;\n}\n\nd-article pre {\n  font-size: 14px;\n  margin-bottom: 20px;\n}\n\nd-article hr {\n  grid-column: screen;\n  width: 100%;\n  border: none;\n  border-bottom: 1px solid rgba(0, 0, 0, 0.1);\n  margin-top: 60px;\n  margin-bottom: 60px;\n}\n\nd-article section {\n  margin-top: 60px;\n  margin-bottom: 60px;\n}\n\nd-article span.equation-mimic {\n  font-family: georgia;\n  font-size: 115%;\n  font-style: italic;\n}\n\nd-article > d-code,\nd-article section > d-code  {\n  display: block;\n}\n\nd-article > d-math[block],\nd-article section > d-math[block]  {\n  display: block;\n}\n\n@media (max-width: 768px) {\n  d-article > d-code,\n  d-article section > d-code,\n  d-article > d-math[block],\n  d-article section > d-math[block] {\n      overflow-x: scroll;\n      -ms-overflow-style: none;  // IE 10+\n      overflow: -moz-scrollbars-none;  // Firefox\n  }\n\n  d-article > d-code::-webkit-scrollbar,\n  d-article section > d-code::-webkit-scrollbar,\n  d-article > d-math[block]::-webkit-scrollbar,\n  d-article section > d-math[block]::-webkit-scrollbar {\n    display: none;  // Safari and Chrome\n  }\n}\n\nd-article .citation {\n  color: #668;\n  cursor: pointer;\n}\n\nd-include {\n  width: auto;\n  display: block;\n}\n\nd-figure {\n  contain: layout style;\n}\n\n/* KaTeX */\n\n.katex, .katex-prerendered {\n  contain: style;\n  display: inline-block;\n}\n\n/* Tables */\n\nd-article table {\n  border-collapse: collapse;\n  margin-bottom: 1.5rem;\n  border-bottom: 1px solid rgba(0, 0, 0, 0.2);\n}\n\nd-article table th {\n  border-bottom: 1px solid rgba(0, 0, 0, 0.2);\n}\n\nd-article table td {\n  border-bottom: 1px solid rgba(0, 0, 0, 0.05);\n}\n\nd-article table tr:last-of-type td {\n  border-bottom: none;\n}\n\nd-article table th,\nd-article table td {\n  font-size: 15px;\n  padding: 2px 8px;\n}\n\nd-article table tbody :first-child td {\n  padding-top: 2px;\n}\n";

  var title = "/*\n * Copyright 2018 The Distill Template Authors\n *\n * Licensed under the Apache License, Version 2.0 (the \"License\");\n * you may not use this file except in compliance with the License.\n * You may obtain a copy of the License at\n *\n *      http://www.apache.org/licenses/LICENSE-2.0\n *\n * Unless required by applicable law or agreed to in writing, software\n * distributed under the License is distributed on an \"AS IS\" BASIS,\n * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n * See the License for the specific language governing permissions and\n * limitations under the License.\n */\n\nd-title {\n  padding: 2rem 0 1.5rem;\n  contain: layout style;\n  overflow-x: hidden;\n}\n\n@media(min-width: 768px) {\n  d-title {\n    padding: 4rem 0 1.5rem;\n  }\n}\n\nd-title h1 {\n  grid-column: text;\n  font-size: 40px;\n  font-weight: 700;\n  line-height: 1.1em;\n  margin: 0 0 0.5rem;\n}\n\n@media(min-width: 768px) {\n  d-title h1 {\n    font-size: 50px;\n  }\n}\n\nd-title p {\n  font-weight: 300;\n  font-size: 1.2rem;\n  line-height: 1.55em;\n  grid-column: text;\n}\n\nd-title .status {\n  margin-top: 0px;\n  font-size: 12px;\n  color: #009688;\n  opacity: 0.8;\n  grid-column: kicker;\n}\n\nd-title .status span {\n  line-height: 1;\n  display: inline-block;\n  padding: 6px 0;\n  border-bottom: 1px solid #80cbc4;\n  font-size: 11px;\n  text-transform: uppercase;\n}\n";

  // Copyright 2018 The Distill Template Authors

  const styles = base + layout + title + byline + article + math + print;

  function makeStyleTag(dom) {

    const styleTagId = 'distill-prerendered-styles';
    const prerenderedTag = dom.getElementById(styleTagId);
    if (!prerenderedTag) {
      const styleTag = dom.createElement('style');
      styleTag.id = styleTagId;
      styleTag.type = 'text/css';
      const cssTextTag = dom.createTextNode(styles);
      styleTag.appendChild(cssTextTag);
      const firstScriptTag = dom.head.querySelector('script');
      dom.head.insertBefore(styleTag, firstScriptTag);
    }

  }

  // Copyright 2018 The Distill Template Authors
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // you may not use this file except in compliance with the License.
  // You may obtain a copy of the License at
  //
  //      http://www.apache.org/licenses/LICENSE-2.0
  //
  // Unless required by applicable law or agreed to in writing, software
  // distributed under the License is distributed on an "AS IS" BASIS,
  // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  // See the License for the specific language governing permissions and
  // limitations under the License.

  function addPolyfill(polyfill, polyfillLoadedCallback) {
    console.debug('Runlevel 0: Polyfill required: ' + polyfill.name);
    const script = document.createElement('script');
    script.src = polyfill.url;
    script.async = false;
    if (polyfillLoadedCallback) {
      script.onload = function() { polyfillLoadedCallback(polyfill); };
    }
    script.onerror = function() {
      new Error('Runlevel 0: Polyfills failed to load script ' + polyfill.name);
    };
    document.head.appendChild(script);
  }

  const polyfills = [
    {
      name: 'WebComponents',
      support: function() {
        return 'customElements' in window &&
               'attachShadow' in Element.prototype &&
               'getRootNode' in Element.prototype &&
               'content' in document.createElement('template') &&
               'Promise' in window &&
               'from' in Array;
      },
      url: 'https://distill.pub/third-party/polyfills/webcomponents-lite.js'
    }, {
      name: 'IntersectionObserver',
      support: function() {
        return 'IntersectionObserver' in window &&
               'IntersectionObserverEntry' in window;
      },
      url: 'https://distill.pub/third-party/polyfills/intersection-observer.js'
    },
  ];

  class Polyfills {

    static browserSupportsAllFeatures() {
      return polyfills.every((poly) => poly.support());
    }

    static load(callback) {
      // Define an intermediate callback that checks if all is loaded.
      const polyfillLoaded = function(polyfill) {
        polyfill.loaded = true;
        console.debug('Runlevel 0: Polyfill has finished loading: ' + polyfill.name);
        // console.debug(window[polyfill.name]);
        if (Polyfills.neededPolyfills.every((poly) => poly.loaded)) {
          console.debug('Runlevel 0: All required polyfills have finished loading.');
          console.debug('Runlevel 0->1.');
          window.distillRunlevel = 1;
          callback();
        }
      };
      // Add polyfill script tags
      for (const polyfill of Polyfills.neededPolyfills) {
        addPolyfill(polyfill, polyfillLoaded);
      }
    }

    static get neededPolyfills() {
      if (!Polyfills._neededPolyfills) {
        Polyfills._neededPolyfills = polyfills.filter((poly) => !poly.support());
      }
      return Polyfills._neededPolyfills;
    }
  }

  // Copyright 2018 The Distill Template Authors
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // you may not use this file except in compliance with the License.
  // You may obtain a copy of the License at
  //
  //      http://www.apache.org/licenses/LICENSE-2.0
  //
  // Unless required by applicable law or agreed to in writing, software
  // distributed under the License is distributed on an "AS IS" BASIS,
  // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  // See the License for the specific language governing permissions and
  // limitations under the License.

  // const marginSmall = 16;
  // const marginLarge = 3 * marginSmall;
  // const margin = marginSmall + marginLarge;
  // const gutter = marginSmall;
  // const outsetAmount = margin / 2;
  // const numCols = 4;
  // const numGutters = numCols - 1;
  // const columnWidth = (768 - 2 * marginLarge - numGutters * gutter) / numCols;
  //
  // const screenwidth = 768;
  // const pageWidth = screenwidth - 2 * marginLarge;
  // const bodyWidth = pageWidth - columnWidth - gutter;

  function body(selector) {
    return `${selector} {
      grid-column: left / text;
    }
  `;
  }

  // Copyright 2018 The Distill Template Authors

  const T$1 = Template('d-abstract', `
<style>
  :host {
    font-size: 1.25rem;
    line-height: 1.6em;
    color: rgba(0, 0, 0, 0.7);
    -webkit-font-smoothing: antialiased;
  }

  ::slotted(p) {
    margin-top: 0;
    margin-bottom: 1em;
    grid-column: text-start / middle-end;
  }
  ${body('d-abstract')}
</style>

<slot></slot>
`);

  class Abstract extends T$1(HTMLElement) {

  }

  // Copyright 2018 The Distill Template Authors

  const T$2 = Template('d-appendix', `
<style>

d-appendix {
  contain: layout style;
  font-size: 0.8em;
  line-height: 1.7em;
  margin-top: 60px;
  margin-bottom: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  color: rgba(0,0,0,0.5);
  padding-top: 60px;
  padding-bottom: 48px;
}

d-appendix h3 {
  grid-column: page-start / text-start;
  font-size: 15px;
  font-weight: 500;
  margin-top: 1em;
  margin-bottom: 0;
  color: rgba(0,0,0,0.65);
}

d-appendix h3 + * {
  margin-top: 1em;
}

d-appendix ol {
  padding: 0 0 0 15px;
}

@media (min-width: 768px) {
  d-appendix ol {
    padding: 0 0 0 30px;
    margin-left: -30px;
  }
}

d-appendix li {
  margin-bottom: 1em;
}

d-appendix a {
  color: rgba(0, 0, 0, 0.6);
}

d-appendix > * {
  grid-column: text;
}

d-appendix > d-footnote-list,
d-appendix > d-citation-list,
d-appendix > distill-appendix {
  grid-column: screen;
}

</style>

`, false);

  class Appendix extends T$2(HTMLElement) {

  }

  // Copyright 2018 The Distill Template Authors
  //
  // Licensed under the Apache License, Version 2.0 (the "License");
  // you may not use this file except in compliance with the License.
  // You may obtain a copy of the License at
  //
  //      http://www.apache.org/licenses/LICENSE-2.0
  //
  // Unless required by applicable law or agreed to in writing, software
  // distributed under the License is distributed on an "AS IS" BASIS,
  // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  // See the License for the specific language governing permissions and
  // limitations under the License.

  // import { Template } from '../mixins/template';
  // import { Controller } from '../controller';

  const isOnlyWhitespace = /^\s*$/;

  class Article extends HTMLElement {
    static get is() { return 'd-article'; }

    constructor() {
      super();

      new MutationObserver( (mutations) => {
        for (const mutation of mutations) {
          for (const addedNode of mutation.addedNodes) {
            switch (addedNode.nodeName) {
            case '#text': { // usually text nodes are only linebreaks.
              const text = addedNode.nodeValue;
              if (!isOnlyWhitespace.test(text)) {
                console.warn('Use of unwrapped text in distill articles is discouraged as it breaks layout! Please wrap any text in a <span> or <p> tag. We found the following text: ' + text);
                const wrapper = document.createElement('span');
                wrapper.innerHTML = addedNode.nodeValue;
                addedNode.parentNode.insertBefore(wrapper, addedNode);
                addedNode.parentNode.removeChild(addedNode);
              }
            } break;
            }
          }
        }
      }).observe(this, {childList: true});
    }

  }

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var bibtexParse = createCommonjsModule(function (module, exports) {
  /* start bibtexParse 0.0.22 */

  //Original work by Henrik Muehe (c) 2010
  //
  //CommonJS port by Mikola Lysenko 2013
  //
  //Port to Browser lib by ORCID / RCPETERS
  //
  //Issues:
  //no comment handling within strings
  //no string concatenation
  //no variable values yet
  //Grammar implemented here:
  //bibtex -> (string | preamble | comment | entry)*;
  //string -> '@STRING' '{' key_equals_value '}';
  //preamble -> '@PREAMBLE' '{' value '}';
  //comment -> '@COMMENT' '{' value '}';
  //entry -> '@' key '{' key ',' key_value_list '}';
  //key_value_list -> key_equals_value (',' key_equals_value)*;
  //key_equals_value -> key '=' value;
  //value -> value_quotes | value_braces | key;
  //value_quotes -> '"' .*? '"'; // not quite
  //value_braces -> '{' .*? '"'; // not quite
  (function(exports) {

      function BibtexParser() {
          
          this.months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
          this.notKey = [',','{','}',' ','='];
          this.pos = 0;
          this.input = "";
          this.entries = new Array();

          this.currentEntry = "";

          this.setInput = function(t) {
              this.input = t;
          };

          this.getEntries = function() {
              return this.entries;
          };

          this.isWhitespace = function(s) {
              return (s == ' ' || s == '\r' || s == '\t' || s == '\n');
          };

          this.match = function(s, canCommentOut) {
              if (canCommentOut == undefined || canCommentOut == null)
                  canCommentOut = true;
              this.skipWhitespace(canCommentOut);
              if (this.input.substring(this.pos, this.pos + s.length) == s) {
                  this.pos += s.length;
              } else {
                  throw "Token mismatch, expected " + s + ", found "
                          + this.input.substring(this.pos);
              }            this.skipWhitespace(canCommentOut);
          };

          this.tryMatch = function(s, canCommentOut) {
              if (canCommentOut == undefined || canCommentOut == null)
                  canCommentOut = true;
              this.skipWhitespace(canCommentOut);
              if (this.input.substring(this.pos, this.pos + s.length) == s) {
                  return true;
              } else {
                  return false;
              }        };

          /* when search for a match all text can be ignored, not just white space */
          this.matchAt = function() {
              while (this.input.length > this.pos && this.input[this.pos] != '@') {
                  this.pos++;
              }
              if (this.input[this.pos] == '@') {
                  return true;
              }            return false;
          };

          this.skipWhitespace = function(canCommentOut) {
              while (this.isWhitespace(this.input[this.pos])) {
                  this.pos++;
              }            if (this.input[this.pos] == "%" && canCommentOut == true) {
                  while (this.input[this.pos] != "\n") {
                      this.pos++;
                  }                this.skipWhitespace(canCommentOut);
              }        };

          this.value_braces = function() {
              var bracecount = 0;
              this.match("{", false);
              var start = this.pos;
              var escaped = false;
              while (true) {
                  if (!escaped) {
                      if (this.input[this.pos] == '}') {
                          if (bracecount > 0) {
                              bracecount--;
                          } else {
                              var end = this.pos;
                              this.match("}", false);
                              return this.input.substring(start, end);
                          }                    } else if (this.input[this.pos] == '{') {
                          bracecount++;
                      } else if (this.pos >= this.input.length - 1) {
                          throw "Unterminated value";
                      }                }                if (this.input[this.pos] == '\\' && escaped == false)
                      escaped = true;
                  else
                      escaped = false;
                  this.pos++;
              }        };

          this.value_comment = function() {
              var str = '';
              var brcktCnt = 0;
              while (!(this.tryMatch("}", false) && brcktCnt == 0)) {
                  str = str + this.input[this.pos];
                  if (this.input[this.pos] == '{')
                      brcktCnt++;
                  if (this.input[this.pos] == '}')
                      brcktCnt--;
                  if (this.pos >= this.input.length - 1) {
                      throw "Unterminated value:" + this.input.substring(start);
                  }                this.pos++;
              }            return str;
          };

          this.value_quotes = function() {
              this.match('"', false);
              var start = this.pos;
              var escaped = false;
              while (true) {
                  if (!escaped) {
                      if (this.input[this.pos] == '"') {
                          var end = this.pos;
                          this.match('"', false);
                          return this.input.substring(start, end);
                      } else if (this.pos >= this.input.length - 1) {
                          throw "Unterminated value:" + this.input.substring(start);
                      }                }
                  if (this.input[this.pos] == '\\' && escaped == false)
                      escaped = true;
                  else
                      escaped = false;
                  this.pos++;
              }        };

          this.single_value = function() {
              var start = this.pos;
              if (this.tryMatch("{")) {
                  return this.value_braces();
              } else if (this.tryMatch('"')) {
                  return this.value_quotes();
              } else {
                  var k = this.key();
                  if (k.match("^[0-9]+$"))
                      return k;
                  else if (this.months.indexOf(k.toLowerCase()) >= 0)
                      return k.toLowerCase();
                  else
                      throw "Value expected:" + this.input.substring(start) + ' for key: ' + k;
              
              }        };

          this.value = function() {
              var values = [];
              values.push(this.single_value());
              while (this.tryMatch("#")) {
                  this.match("#");
                  values.push(this.single_value());
              }            return values.join("");
          };

          this.key = function() {
              var start = this.pos;
              while (true) {
                  if (this.pos >= this.input.length) {
                      throw "Runaway key";
                  }                                // а-яА-Я is Cyrillic
                  //console.log(this.input[this.pos]);
                  if (this.notKey.indexOf(this.input[this.pos]) >= 0) {
                      return this.input.substring(start, this.pos);
                  } else {
                      this.pos++;
                      
                  }            }        };

          this.key_equals_value = function() {
              var key = this.key();
              if (this.tryMatch("=")) {
                  this.match("=");
                  var val = this.value();
                  return [ key, val ];
              } else {
                  throw "... = value expected, equals sign missing:"
                          + this.input.substring(this.pos);
              }        };

          this.key_value_list = function() {
              var kv = this.key_equals_value();
              this.currentEntry['entryTags'] = {};
              this.currentEntry['entryTags'][kv[0]] = kv[1];
              while (this.tryMatch(",")) {
                  this.match(",");
                  // fixes problems with commas at the end of a list
                  if (this.tryMatch("}")) {
                      break;
                  }
                  kv = this.key_equals_value();
                  this.currentEntry['entryTags'][kv[0]] = kv[1];
              }        };

          this.entry_body = function(d) {
              this.currentEntry = {};
              this.currentEntry['citationKey'] = this.key();
              this.currentEntry['entryType'] = d.substring(1);
              this.match(",");
              this.key_value_list();
              this.entries.push(this.currentEntry);
          };

          this.directive = function() {
              this.match("@");
              return "@" + this.key();
          };

          this.preamble = function() {
              this.currentEntry = {};
              this.currentEntry['entryType'] = 'PREAMBLE';
              this.currentEntry['entry'] = this.value_comment();
              this.entries.push(this.currentEntry);
          };

          this.comment = function() {
              this.currentEntry = {};
              this.currentEntry['entryType'] = 'COMMENT';
              this.currentEntry['entry'] = this.value_comment();
              this.entries.push(this.currentEntry);
          };

          this.entry = function(d) {
              this.entry_body(d);
          };

          this.bibtex = function() {
              while (this.matchAt()) {
                  var d = this.directive();
                  this.match("{");
                  if (d == "@STRING") {
                      this.string();
                  } else if (d == "@PREAMBLE") {
                      this.preamble();
                  } else if (d == "@COMMENT") {
                      this.comment();
                  } else {
                      this.entry(d);
                  }
                  this.match("}");
              }        };
      }    
      exports.toJSON = function(bibtex) {
          var b = new BibtexParser();
          b.setInput(bibtex);
          b.bibtex();
          return b.entries;
      };

      /* added during hackathon don't hate on me */
      exports.toBibtex = function(json) {
          var out = '';
          for ( var i in json) {
              out += "@" + json[i].entryType;
              out += '{';
              if (json[i].citationKey)
                  out += json[i].citationKey + ', ';
              if (json[i].entry)
                  out += json[i].entry ;
              if (json[i].entryTags) {
                  var tags = '';
                  for (var jdx in js