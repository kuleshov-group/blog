(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('fs')) :
  typeof define === 'function' && define.amd ? define(['exports', 'fs'], factory) :
  (global = global || self, factory(global.dl = {}, global.fs));
}(this, (function (exports, fs) { 'use strict';

  fs = fs && Object.prototype.hasOwnProperty.call(fs, 'default') ? fs['default'] : fs;

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

  // Copyright 2018 The Distill Template Authors

  function ExtractFrontmatter(dom, data) {
    const frontMatterTag = dom.querySelector('d-front-matter');
    if (!frontMatterTag) {
      console.warn('No front matter tag found!');
      return;
    }
    const extractedData = parseFrontmatter(frontMatterTag);
    mergeFromYMLFrontmatter(data, extractedData);
  }

  function commonjsRequire () {
  	throw new Error('Dynamic requires are not currently supported by rollup-plugin-commonjs');
  }

  function unwrapExports (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

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
                  for (var jdx in json[i].entryTags) {
                      if (tags.length != 0)
                          tags += ', ';
                      tags += jdx + '= {' + json[i].entryTags[jdx] + '}';
                  }
                  out += tags;
              }
              out += '}\n\n';
          }
          return out;
          
      };

  })( exports);

  /* end bibtexParse */
  });

  // Copyright 2018 The Distill Template Authors

  function normalizeTag(string) {
    return string
      .replace(/[\t\n ]+/g, ' ')
      .replace(/{\\["^`.'acu~Hvs]( )?([a-zA-Z])}/g, (full, x, char) => char)
      .replace(/{\\([a-zA-Z])}/g, (full, char) => char);
  }

  function parseBibtex(bibtex) {
    const bibliography = new Map();
    const parsedEntries = bibtexParse.toJSON(bibtex);
    for (const entry of parsedEntries) {
      // normalize tags; note entryTags is an object, not Map
      for (const [key, value] of Object.entries(entry.entryTags)) {
        entry.entryTags[key.toLowerCase()] = normalizeTag(value);
      }
      entry.entryTags.type = entry.entryType;
      // add to bibliography
      bibliography.set(entry.citationKey, entry.entryTags);
    }
    return bibliography;
  }

  function serializeFrontmatterToBibtex(frontMatter) {
    return `@article{${frontMatter.slug},
  author = {${frontMatter.bibtexAuthors}},
  title = {${frontMatter.title}},
  journal = {${frontMatter.journal.title}},
  year = {${frontMatter.publishedYear}},
  note = {${frontMatter.url}},
  doi = {${frontMatter.doi}}
}`;
  }

  // Copyright 2018 The Distill Template Authors

  function parseBibliography(element) {
    const scriptTag = element.firstElementChild;
    if (scriptTag && scriptTag.tagName === 'SCRIPT') {
      if (scriptTag.type == 'text/bibtex') {
        const bibtex = element.firstElementChild.textContent;
        return parseBibtex(bibtex);
      } else if (scriptTag.type == 'text/json') {
        return new Map(JSON.parse(scriptTag.textContent));
      } else {
        console.warn('Unsupported bibliography script tag type: ' + scriptTag.type);
      }
    } else {
      console.warn('Bibliography did not have any script tag.');
    }
  }

  // Copyright 2018 The Distill Template Authors

  function ExtractBibliography(dom, data) {
    const bibliographyTag = dom.querySelector('d-bibliography');
    if (!bibliographyTag) {
      console.warn('No bibliography tag found!');
      return;
    }

    const src = bibliographyTag.getAttribute('src');
    if (src) {
      const path = data.inputDirectory + '/' + src;
      const text = fs.readFileSync(path, 'utf-8');
      const bibliography = parseBibtex(text);
      const scriptTag = dom.createElement('script');
      scriptTag.type = 'text/json';
      scriptTag.textContent = JSON.stringify([...bibliography]);
      bibliographyTag.appendChild(scriptTag);
      bibliographyTag.removeAttribute('src');
    }

    data.bibliography = parseBibliography(bibliographyTag);
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

  // Copyright 2018 The Distill Template Authors

  function ExtractCitations(dom, data) {
    const citations = new Set(data.citations);
    const newCitations = collect_citations(dom);
    for (const citation of newCitations) {
      citations.add(citation);
    }
    data.citations = Array.from(citations);
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

  function HTML(dom) {

    const head = dom.querySelector('head');

    // set language to 'en'
    if (!dom.querySelector('html').getAttribute('lang')) {
      dom.querySelector('html').setAttribute('lang', 'en');
    }

    // set charset to 'utf-8'
    if (!dom.querySelector('meta[charset]')) {
      const meta = dom.createElement('meta');
      meta.setAttribute('charset', 'utf-8');
      head.appendChild(meta);
    }

    // set viewport
    if (!dom.querySelector('meta[name=viewport]')) {
      const meta = dom.createElement('meta');
      meta.setAttribute('name', 'viewport');
      meta.setAttribute('content', 'width=device-width, initial-scale=1');
      head.appendChild(meta);
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

  // import style from '../styles/d-byline.css';

  function bylineTemplate(frontMatter) {
    return `
  <div class="byline grid">
    <div class="authors-affiliations grid">
      <h3>Authors</h3>
      <h3>Affiliations</h3>
      ${frontMatter.authors.map(author => `
        <p class="author">
          ${author.personalURL ? `
            <a class="name" href="${author.personalURL}">${author.name}</a>` : `
            <span class="name">${author.name}</span>`}
        </p>
        <p class="affiliation">
        ${author.affiliations.map(affiliation =>
          affiliation.url ? `<a class="affiliation" href="${affiliation.url}">${affiliation.name}</a>` : `<span class="affiliation">${affiliation.name}</span>`
        ).join(', ')}
        </p>
      `).join('')}
    </div>
    <div>
      <h3>Published</h3>
      ${frontMatter.publishedDate ? `
        <p>${frontMatter.publishedMonth} ${frontMatter.publishedDay}, ${frontMatter.publishedYear}</p> ` : `
        <p><em>Not published yet.</em></p>`}
    </div>
    <div>
      <h3>DOI</h3>
      ${frontMatter.doi ? `
        <p><a href="https://doi.org/${frontMatter.doi}">${frontMatter.doi}</a></p>` : `
        <p><em>No DOI yet.</em></p>`}
    </div>
  </div>
`;
  }

  // Copyright 2018 The Distill Template Authors

  function Byline(dom, data) {
    const byline = dom.querySelector('d-byline');
    if (byline) {
      byline.innerHTML = bylineTemplate(data);
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

  function OptionalComponents(dom, data) {
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

  var katex$1 = createCommonjsModule(function (module, exports) {
  (function(f){{module.exports=f();}})(function(){return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof commonjsRequire=="function"&&commonjsRequire;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r);}return n[o].exports}var i=typeof commonjsRequire=="function"&&commonjsRequire;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

  var _ParseError = require("./src/ParseError");

  var _ParseError2 = _interopRequireDefault(_ParseError);

  var _Settings = require("./src/Settings");

  var _Settings2 = _interopRequireDefault(_Settings);

  var _buildTree = require("./src/buildTree");

  var _buildTree2 = _interopRequireDefault(_buildTree);

  var _parseTree = require("./src/parseTree");

  var _parseTree2 = _interopRequireDefault(_parseTree);

  var _utils = require("./src/utils");

  var _utils2 = _interopRequireDefault(_utils);

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

  /**
   * Parse and build an expression, and place that expression in the DOM node
   * given.
   */
  var render = function render(expression, baseNode, options) {
      _utils2.default.clearNode(baseNode);

      var settings = new _Settings2.default(options);

      var tree = (0, _parseTree2.default)(expression, settings);
      var node = (0, _buildTree2.default)(tree, expression, settings).toNode();

      baseNode.appendChild(node);
  };

  // KaTeX's styles don't work properly in quirks mode. Print out an error, and
  // disable rendering.
  /* eslint no-console:0 */
  /**
   * This is the main entry point for KaTeX. Here, we expose functions for
   * rendering expressions either to DOM nodes or to markup strings.
   *
   * We also expose the ParseError class to check if errors thrown from KaTeX are
   * errors in the expression, or errors in javascript handling.
   */

  if (typeof document !== "undefined") {
      if (document.compatMode !== "CSS1Compat") {
          typeof console !== "undefined" && console.warn("Warning: KaTeX doesn't work in quirks mode. Make sure your " + "website has a suitable doctype.");

          render = function render() {
              throw new _ParseError2.default("KaTeX doesn't work in quirks mode.");
          };
      }
  }

  /**
   * Parse and build an expression, and return the markup for that.
   */
  var renderToString = function renderToString(expression, options) {
      var settings = new _Settings2.default(options);

      var tree = (0, _parseTree2.default)(expression, settings);
      return (0, _buildTree2.default)(tree, expression, settings).toMarkup();
  };

  /**
   * Parse an expression and return the parse tree.
   */
  var generateParseTree = function generateParseTree(expression, options) {
      var settings = new _Settings2.default(options);
      return (0, _parseTree2.default)(expression, settings);
  };

  module.exports = {
      render: render,
      renderToString: renderToString,
      /**
       * NOTE: This method is not currently recommended for public use.
       * The internal tree representation is unstable and is very likely
       * to change. Use at your own risk.
       */
      __parse: generateParseTree,
      ParseError: _ParseError2.default
  };

  },{"./src/ParseError":29,"./src/Settings":32,"./src/buildTree":37,"./src/parseTree":46,"./src/utils":51}],2:[function(require,module,exports){
  module.exports = { "default": require("core-js/library/fn/json/stringify"), __esModule: true };
  },{"core-js/library/fn/json/stringify":6}],3:[function(require,module,exports){
  module.exports = { "default": require("core-js/library/fn/object/define-property"), __esModule: true };
  },{"core-js/library/fn/object/define-property":7}],4:[function(require,module,exports){

  exports.__esModule = true;

  exports.default = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };
  },{}],5:[function(require,module,exports){

  exports.__esModule = true;

  var _defineProperty = require("../core-js/object/define-property");

  var _defineProperty2 = _interopRequireDefault(_defineProperty);

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

  exports.default = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        (0, _defineProperty2.default)(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();
  },{"../core-js/object/define-property":3}],6:[function(require,module,exports){
  var core  = require('../../modules/_core')
    , $JSON = core.JSON || (core.JSON = {stringify: JSON.stringify});
  module.exports = function stringify(it){ // eslint-disable-line no-unused-vars
    return $JSON.stringify.apply($JSON, arguments);
  };
  },{"../../modules/_core":10}],7:[function(require,module,exports){
  require('../../modules/es6.object.define-property');
  var $Object = require('../../modules/_core').Object;
  module.exports = function defineProperty(it, key, desc){
    return $Object.defineProperty(it, key, desc);
  };
  },{"../../modules/_core":10,"../../modules/es6.object.define-property":23}],8:[function(require,module,exports){
  module.exports = function(it){
    if(typeof it != 'function')throw TypeError(it + ' is not a function!');
    return it;
  };
  },{}],9:[function(require,module,exports){
  var isObject = require('./_is-object');
  module.exports = function(it){
    if(!isObject(it))throw TypeError(it + ' is not an object!');
    return it;
  };
  },{"./_is-object":19}],10:[function(require,module,exports){
  var core = module.exports = {version: '2.4.0'};
  if(typeof __e == 'number')__e = core; // eslint-disable-line no-undef
  },{}],11:[function(require,module,exports){
  // optional / simple context binding
  var aFunction = require('./_a-function');
  module.exports = function(fn, that, length){
    aFunction(fn);
    if(that === undefined)return fn;
    switch(length){
      case 1: return function(a){
        return fn.call(that, a);
      };
      case 2: return function(a, b){
        return fn.call(that, a, b);
      };
      case 3: return function(a, b, c){
        return fn.call(that, a, b, c);
      };
    }
    return function(/* ...args */){
      return fn.apply(that, arguments);
    };
  };
  },{"./_a-function":8}],12:[function(require,module,exports){
  // Thank's IE8 for his funny defineProperty
  module.exports = !require('./_fails')(function(){
    return Object.defineProperty({}, 'a', {get: function(){ return 7; }}).a != 7;
  });
  },{"./_fails":15}],13:[function(require,module,exports){
  var isObject = require('./_is-object')
    , document = require('./_global').document
    // in old IE typeof document.createElement is 'object'
    , is = isObject(document) && isObject(document.createElement);
  module.exports = function(it){
    return is ? document.createElement(it) : {};
  };
  },{"./_global":16,"./_is-object":19}],14:[function(require,module,exports){
  var global    = require('./_global')
    , core      = require('./_core')
    , ctx       = require('./_ctx')
    , hide      = require('./_hide')
    , PROTOTYPE = 'prototype';

  var $export = function(type, name, source){
    var IS_FORCED = type & $export.F
      , IS_GLOBAL = type & $export.G
      , IS_STATIC = type & $export.S
      , IS_PROTO  = type & $export.P
      , IS_BIND   = type & $export.B
      , IS_WRAP   = type & $export.W
      , exports   = IS_GLOBAL ? core : core[name] || (core[name] = {})
      , expProto  = exports[PROTOTYPE]
      , target    = IS_GLOBAL ? global : IS_STATIC ? global[name] : (global[name] || {})[PROTOTYPE]
      , key, own, out;
    if(IS_GLOBAL)source = name;
    for(key in source){
      // contains in native
      own = !IS_FORCED && target && target[key] !== undefined;
      if(own && key in exports)continue;
      // export native or passed
      out = own ? target[key] : source[key];
      // prevent global pollution for namespaces
      exports[key] = IS_GLOBAL && typeof target[key] != 'function' ? source[key]
      // bind timers to global for call from export context
      : IS_BIND && own ? ctx(out, global)
      // wrap global constructors for prevent change them in library
      : IS_WRAP && target[key] == out ? (function(C){
        var F = function(a, b, c){
          if(this instanceof C){
            switch(arguments.length){
              case 0: return new C;
              case 1: return new C(a);
              case 2: return new C(a, b);
            } return new C(a, b, c);
          } return C.apply(this, arguments);
        };
        F[PROTOTYPE] = C[PROTOTYPE];
        return F;
      // make static versions for prototype methods
      })(out) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
      // export proto methods to core.%CONSTRUCTOR%.methods.%NAME%
      if(IS_PROTO){
        (exports.virtual || (exports.virtual = {}))[key] = out;
        // export proto methods to core.%CONSTRUCTOR%.prototype.%NAME%
        if(type & $export.R && expProto && !expProto[key])hide(expProto, key, out);
      }
    }
  };
  // type bitmap
  $export.F = 1;   // forced
  $export.G = 2;   // global
  $export.S = 4;   // static
  $export.P = 8;   // proto
  $export.B = 16;  // bind
  $export.W = 32;  // wrap
  $export.U = 64;  // safe
  $export.R = 128; // real proto method for `library` 
  module.exports = $export;
  },{"./_core":10,"./_ctx":11,"./_global":16,"./_hide":17}],15:[function(require,module,exports){
  module.exports = function(exec){
    try {
      return !!exec();
    } catch(e){
      return true;
    }
  };
  },{}],16:[function(require,module,exports){
  // https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
  var global = module.exports = typeof window != 'undefined' && window.Math == Math
    ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
  if(typeof __g == 'number')__g = global; // eslint-disable-line no-undef
  },{}],17:[function(require,module,exports){
  var dP         = require('./_object-dp')
    , createDesc = require('./_property-desc');
  module.exports = require('./_descriptors') ? function(object, key, value){
    return dP.f(object, key, createDesc(1, value));
  } : function(object, key, value){
    object[key] = value;
    return object;
  };
  },{"./_descriptors":12,"./_object-dp":20,"./_property-desc":21}],18:[function(require,module,exports){
  module.exports = !require('./_descriptors') && !require('./_fails')(function(){
    return Object.defineProperty(require('./_dom-create')('div'), 'a', {get: function(){ return 7; }}).a != 7;
  });
  },{"./_descriptors":12,"./_dom-create":13,"./_fails":15}],19:[function(require,module,exports){
  module.exports = function(it){
    return typeof it === 'object' ? it !== null : typeof it === 'function';
  };
  },{}],20:[function(require,module,exports){
  var anObject       = require('./_an-object')
    , IE8_DOM_DEFINE = require('./_ie8-dom-define')
    , toPrimitive    = require('./_to-primitive')
    , dP             = Object.defineProperty;

  exports.f = require('./_descriptors') ? Object.defineProperty : function defineProperty(O, P, Attributes){
    anObject(O);
    P = toPrimitive(P, true);
    anObject(Attributes);
    if(IE8_DOM_DEFINE)try {
      return dP(O, P, Attributes);
    } catch(e){ /* empty */ }
    if('get' in Attributes || 'set' in Attributes)throw TypeError('Accessors not supported!');
    if('value' in Attributes)O[P] = Attributes.value;
    return O;
  };
  },{"./_an-object":9,"./_descriptors":12,"./_ie8-dom-define":18,"./_to-primitive":22}],21:[function(require,module,exports){
  module.exports = function(bitmap, value){
    return {
      enumerable  : !(bitmap & 1),
      configurable: !(bitmap & 2),
      writable    : !(bitmap & 4),
      value       : value
    };
  };
  },{}],22:[function(require,module,exports){
  // 7.1.1 ToPrimitive(input [, PreferredType])
  var isObject = require('./_is-object');
  // instead of the ES6 spec version, we didn't implement @@toPrimitive case
  // and the second argument - flag - preferred type is a string
  module.exports = function(it, S){
    if(!isObject(it))return it;
    var fn, val;
    if(S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it)))return val;
    if(typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it)))return val;
    if(!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it)))return val;
    throw TypeError("Can't convert object to primitive value");
  };
  },{"./_is-object":19}],23:[function(require,module,exports){
  var $export = require('./_export');
  // 19.1.2.4 / 15.2.3.6 Object.defineProperty(O, P, Attributes)
  $export($export.S + $export.F * !require('./_descriptors'), 'Object', {defineProperty: require('./_object-dp').f});
  },{"./_descriptors":12,"./_export":14,"./_object-dp":20}],24:[function(require,module,exports){

  function getRelocatable(re) {
    // In the future, this could use a WeakMap instead of an expando.
    if (!re.__matchAtRelocatable) {
      // Disjunctions are the lowest-precedence operator, so we can make any
      // pattern match the empty string by appending `|()` to it:
      // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-patterns
      var source = re.source + "|()";

      // We always make the new regex global.
      var flags = "g" + (re.ignoreCase ? "i" : "") + (re.multiline ? "m" : "") + (re.unicode ? "u" : "")
      // sticky (/.../y) doesn't make sense in conjunction with our relocation
      // logic, so we ignore it here.
      ;

      re.__matchAtRelocatable = new RegExp(source, flags);
    }
    return re.__matchAtRelocatable;
  }

  function matchAt(re, str, pos) {
    if (re.global || re.sticky) {
      throw new Error("matchAt(...): Only non-global regexes are supported");
    }
    var reloc = getRelocatable(re);
    reloc.lastIndex = pos;
    var match = reloc.exec(str);
    // Last capturing group is our sentinel that indicates whether the regex
    // matched at the given location.
    if (match[match.length - 1] == null) {
      // Original regex matched.
      match.length = match.length - 1;
      return match;
    } else {
      return null;
    }
  }

  module.exports = matchAt;
  },{}],25:[function(require,module,exports){
  /* eslint-disable no-unused-vars */
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var propIsEnumerable = Object.prototype.propertyIsEnumerable;

  function toObject(val) {
  	if (val === null || val === undefined) {
  		throw new TypeError('Object.assign cannot be called with null or undefined');
  	}

  	return Object(val);
  }

  function shouldUseNative() {
  	try {
  		if (!Object.assign) {
  			return false;
  		}

  		// Detect buggy property enumeration order in older V8 versions.

  		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
  		var test1 = new String('abc');  // eslint-disable-line
  		test1[5] = 'de';
  		if (Object.getOwnPropertyNames(test1)[0] === '5') {
  			return false;
  		}

  		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
  		var test2 = {};
  		for (var i = 0; i < 10; i++) {
  			test2['_' + String.fromCharCode(i)] = i;
  		}
  		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
  			return test2[n];
  		});
  		if (order2.join('') !== '0123456789') {
  			return false;
  		}

  		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
  		var test3 = {};
  		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
  			test3[letter] = letter;
  		});
  		if (Object.keys(Object.assign({}, test3)).join('') !==
  				'abcdefghijklmnopqrst') {
  			return false;
  		}

  		return true;
  	} catch (e) {
  		// We don't expect any of the above to throw, but better to be safe.
  		return false;
  	}
  }

  module.exports = shouldUseNative() ? Object.assign : function (target, source) {
  	var from;
  	var to = toObject(target);
  	var symbols;

  	for (var s = 1; s < arguments.length; s++) {
  		from = Object(arguments[s]);

  		for (var key in from) {
  			if (hasOwnProperty.call(from, key)) {
  				to[key] = from[key];
  			}
  		}

  		if (Object.getOwnPropertySymbols) {
  			symbols = Object.getOwnPropertySymbols(from);
  			for (var i = 0; i < symbols.length; i++) {
  				if (propIsEnumerable.call(from, symbols[i])) {
  					to[symbols[i]] = from[symbols[i]];
  				}
  			}
  		}
  	}

  	return to;
  };

  },{}],26:[function(require,module,exports){

  var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

  var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

  var _createClass2 = require("babel-runtime/helpers/createClass");

  var _createClass3 = _interopRequireDefault(_createClass2);

  var _matchAt = require("match-at");

  var _matchAt2 = _interopRequireDefault(_matchAt);

  var _ParseError = require("./ParseError");

  var _ParseError2 = _interopRequireDefault(_ParseError);

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

  /**
   * The resulting token returned from `lex`.
   *
   * It consists of the token text plus some position information.
   * The position information is essentially a range in an input string,
   * but instead of referencing the bare input string, we refer to the lexer.
   * That way it is possible to attach extra metadata to the input string,
   * like for example a file name or similar.
   *
   * The position information (all three parameters) is optional,
   * so it is OK to construct synthetic tokens if appropriate.
   * Not providing available position information may lead to
   * degraded error reporting, though.
   *
   * @param {string}  text   the text of this token
   * @param {number=} start  the start offset, zero-based inclusive
   * @param {number=} end    the end offset, zero-based exclusive
   * @param {Lexer=}  lexer  the lexer which in turn holds the input string
   */
  /**
   * The Lexer class handles tokenizing the input in various ways. Since our
   * parser expects us to be able to backtrack, the lexer allows lexing from any
   * given starting point.
   *
   * Its main exposed function is the `lex` function, which takes a position to
   * lex from and a type of token to lex. It defers to the appropriate `_innerLex`
   * function.
   *
   * The various `_innerLex` functions perform the actual lexing of different
   * kinds.
   */

  var Token = function () {
      function Token(text, start, end, lexer) {
          (0, _classCallCheck3.default)(this, Token);

          this.text = text;
          this.start = start;
          this.end = end;
          this.lexer = lexer;
      }

      /**
       * Given a pair of tokens (this and endToken), compute a “Token” encompassing
       * the whole input range enclosed by these two.
       *
       * @param {Token}  endToken  last token of the range, inclusive
       * @param {string} text      the text of the newly constructed token
       */


      (0, _createClass3.default)(Token, [{
          key: "range",
          value: function range(endToken, text) {
              if (endToken.lexer !== this.lexer) {
                  return new Token(text); // sorry, no position information available
              }
              return new Token(text, this.start, endToken.end, this.lexer);
          }
      }]);
      return Token;
  }();

  /* The following tokenRegex
   * - matches typical whitespace (but not NBSP etc.) using its first group
   * - does not match any control character \x00-\x1f except whitespace
   * - does not match a bare backslash
   * - matches any ASCII character except those just mentioned
   * - does not match the BMP private use area \uE000-\uF8FF
   * - does not match bare surrogate code units
   * - matches any BMP character except for those just described
   * - matches any valid Unicode surrogate pair
   * - matches a backslash followed by one or more letters
   * - matches a backslash followed by any BMP character, including newline
   * Just because the Lexer matches something doesn't mean it's valid input:
   * If there is no matching function or symbol definition, the Parser will
   * still reject the input.
   */


  var tokenRegex = new RegExp("([ \r\n\t]+)|" + // whitespace
  "([!-\\[\\]-\u2027\u202A-\uD7FF\uF900-\uFFFF]" + // single codepoint
  "|[\uD800-\uDBFF][\uDC00-\uDFFF]" + // surrogate pair
  "|\\\\(?:[a-zA-Z]+|[^\uD800-\uDFFF])" + // function name
  ")");

  /*
   * Main Lexer class
   */

  var Lexer = function () {
      function Lexer(input) {
          (0, _classCallCheck3.default)(this, Lexer);

          this.input = input;
          this.pos = 0;
      }

      /**
       * This function lexes a single token.
       */


      (0, _createClass3.default)(Lexer, [{
          key: "lex",
          value: function lex() {
              var input = this.input;
              var pos = this.pos;
              if (pos === input.length) {
                  return new Token("EOF", pos, pos, this);
              }
              var match = (0, _matchAt2.default)(tokenRegex, input, pos);
              if (match === null) {
                  throw new _ParseError2.default("Unexpected character: '" + input[pos] + "'", new Token(input[pos], pos, pos + 1, this));
              }
              var text = match[2] || " ";
              var start = this.pos;
              this.pos += match[0].length;
              var end = this.pos;
              return new Token(text, start, end, this);
          }
      }]);
      return Lexer;
  }();

  module.exports = Lexer;

  },{"./ParseError":29,"babel-runtime/helpers/classCallCheck":4,"babel-runtime/helpers/createClass":5,"match-at":24}],27:[function(require,module,exports){

  var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

  var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

  var _createClass2 = require("babel-runtime/helpers/createClass");

  var _createClass3 = _interopRequireDefault(_createClass2);

  var _Lexer = require("./Lexer");

  var _Lexer2 = _interopRequireDefault(_Lexer);

  var _macros = require("./macros");

  var _macros2 = _interopRequireDefault(_macros);

  var _ParseError = require("./ParseError");

  var _ParseError2 = _interopRequireDefault(_ParseError);

  var _objectAssign = require("object-assign");

  var _objectAssign2 = _interopRequireDefault(_objectAssign);

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

  /**
   * This file contains the “gullet” where macros are expanded
   * until only non-macro tokens remain.
   */

  var MacroExpander = function () {
      function MacroExpander(input, macros) {
          (0, _classCallCheck3.default)(this, MacroExpander);

          this.lexer = new _Lexer2.default(input);
          this.macros = (0, _objectAssign2.default)({}, _macros2.default, macros);
          this.stack = []; // contains tokens in REVERSE order
          this.discardedWhiteSpace = [];
      }

      /**
       * Recursively expand first token, then return first non-expandable token.
       *
       * At the moment, macro expansion doesn't handle delimited macros,
       * i.e. things like those defined by \def\foo#1\end{…}.
       * See the TeX book page 202ff. for details on how those should behave.
       */


      (0, _createClass3.default)(MacroExpander, [{
          key: "nextToken",
          value: function nextToken() {
              for (;;) {
                  if (this.stack.length === 0) {
                      this.stack.push(this.lexer.lex());
                  }
                  var topToken = this.stack.pop();
                  var name = topToken.text;
                  if (!(name.charAt(0) === "\\" && this.macros.hasOwnProperty(name))) {
                      return topToken;
                  }
                  var tok = void 0;
                  var expansion = this.macros[name];
                  if (typeof expansion === "string") {
                      var numArgs = 0;
                      if (expansion.indexOf("#") !== -1) {
                          var stripped = expansion.replace(/##/g, "");
                          while (stripped.indexOf("#" + (numArgs + 1)) !== -1) {
                              ++numArgs;
                          }
                      }
                      var bodyLexer = new _Lexer2.default(expansion);
                      expansion = [];
                      tok = bodyLexer.lex();
                      while (tok.text !== "EOF") {
                          expansion.push(tok);
                          tok = bodyLexer.lex();
                      }
                      expansion.reverse(); // to fit in with stack using push and pop
                      expansion.numArgs = numArgs;
                      this.macros[name] = expansion;
                  }
                  if (expansion.numArgs) {
                      var args = [];
                      var i = void 0;
                      // obtain arguments, either single token or balanced {…} group
                      for (i = 0; i < expansion.numArgs; ++i) {
                          var startOfArg = this.get(true);
                          if (startOfArg.text === "{") {
                              var arg = [];
                              var depth = 1;
                              while (depth !== 0) {
                                  tok = this.get(false);
                                  arg.push(tok);
                                  if (tok.text === "{") {
                                      ++depth;
                                  } else if (tok.text === "}") {
                                      --depth;
                                  } else if (tok.text === "EOF") {
                                      throw new _ParseError2.default("End of input in macro argument", startOfArg);
                                  }
                              }
                              arg.pop(); // remove last }
                              arg.reverse(); // like above, to fit in with stack order
                              args[i] = arg;
                          } else if (startOfArg.text === "EOF") {
                              throw new _ParseError2.default("End of input expecting macro argument", topToken);
                          } else {
                              args[i] = [startOfArg];
                          }
                      }
                      // paste arguments in place of the placeholders
                      expansion = expansion.slice(); // make a shallow copy
                      for (i = expansion.length - 1; i >= 0; --i) {
                          tok = expansion[i];
                          if (tok.text === "#") {
                              if (i === 0) {
                                  throw new _ParseError2.default("Incomplete placeholder at end of macro body", tok);
                              }
                              tok = expansion[--i]; // next token on stack
                              if (tok.text === "#") {
                                  // ## → #
                                  expansion.splice(i + 1, 1); // drop first #
                              } else if (/^[1-9]$/.test(tok.text)) {
                                  // expansion.splice(i, 2, arg[0], arg[1], …)
                                  // to replace placeholder with the indicated argument.
                                  // TODO: use spread once we move to ES2015
                                  expansion.splice.apply(expansion, [i, 2].concat(args[tok.text - 1]));
                              } else {
                                  throw new _ParseError2.default("Not a valid argument number", tok);
                              }
                          }
                      }
                  }
                  this.stack = this.stack.concat(expansion);
              }
          }
      }, {
          key: "get",
          value: function get(ignoreSpace) {
              this.discardedWhiteSpace = [];
              var token = this.nextToken();
              if (ignoreSpace) {
                  while (token.text === " ") {
                      this.discardedWhiteSpace.push(token);
                      token = this.nextToken();
                  }
              }
              return token;
          }

          /**
           * Undo the effect of the preceding call to the get method.
           * A call to this method MUST be immediately preceded and immediately followed
           * by a call to get.  Only used during mode switching, i.e. after one token
           * was got in the old mode but should get got again in a new mode
           * with possibly different whitespace handling.
           */

      }, {
          key: "unget",
          value: function unget(token) {
              this.stack.push(token);
              while (this.discardedWhiteSpace.length !== 0) {
                  this.stack.push(this.discardedWhiteSpace.pop());
              }
          }
      }]);
      return MacroExpander;
  }();

  module.exports = MacroExpander;

  },{"./Lexer":26,"./ParseError":29,"./macros":44,"babel-runtime/helpers/classCallCheck":4,"babel-runtime/helpers/createClass":5,"object-assign":25}],28:[function(require,module,exports){

  var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

  var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

  var _createClass2 = require("babel-runtime/helpers/createClass");

  var _createClass3 = _interopRequireDefault(_createClass2);

  var _fontMetrics2 = require("./fontMetrics");

  var _fontMetrics3 = _interopRequireDefault(_fontMetrics2);

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

  var BASESIZE = 6; /**
                     * This file contains information about the options that the Parser carries
                     * around with it while parsing. Data is held in an `Options` object, and when
                     * recursing, a new `Options` object can be created with the `.with*` and
                     * `.reset` functions.
                     */

  var sizeStyleMap = [
  // Each element contains [textsize, scriptsize, scriptscriptsize].
  // The size mappings are taken from TeX with \normalsize=10pt.
  [1, 1, 1], // size1: [5, 5, 5]              \tiny
  [2, 1, 1], // size2: [6, 5, 5]
  [3, 1, 1], // size3: [7, 5, 5]              \scriptsize
  [4, 2, 1], // size4: [8, 6, 5]              \footnotesize
  [5, 2, 1], // size5: [9, 6, 5]              \small
  [6, 3, 1], // size6: [10, 7, 5]             \normalsize
  [7, 4, 2], // size7: [12, 8, 6]             \large
  [8, 6, 3], // size8: [14.4, 10, 7]          \Large
  [9, 7, 6], // size9: [17.28, 12, 10]        \LARGE
  [10, 8, 7], // size10: [20.74, 14.4, 12]     \huge
  [11, 10, 9]];

  var sizeMultipliers = [
  // fontMetrics.js:getFontMetrics also uses size indexes, so if
  // you change size indexes, change that function.
  0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.44, 1.728, 2.074, 2.488];

  var sizeAtStyle = function sizeAtStyle(size, style) {
      return style.size < 2 ? size : sizeStyleMap[size - 1][style.size - 1];
  };

  /**
   * This is the main options class. It contains the current style, size, color,
   * and font.
   *
   * Options objects should not be modified. To create a new Options with
   * different properties, call a `.having*` method.
   */

  var Options = function () {
      function Options(data) {
          (0, _classCallCheck3.default)(this, Options);

          this.style = data.style;
          this.color = data.color;
          this.size = data.size || BASESIZE;
          this.textSize = data.textSize || this.size;
          this.phantom = data.phantom;
          this.font = data.font;
          this.sizeMultiplier = sizeMultipliers[this.size - 1];
          this._fontMetrics = null;
      }

      /**
       * Returns a new options object with the same properties as "this".  Properties
       * from "extension" will be copied to the new options object.
       */


      (0, _createClass3.default)(Options, [{
          key: "extend",
          value: function extend(extension) {
              var data = {
                  style: this.style,
                  size: this.size,
                  textSize: this.textSize,
                  color: this.color,
                  phantom: this.phantom,
                  font: this.font
              };

              for (var key in extension) {
                  if (extension.hasOwnProperty(key)) {
                      data[key] = extension[key];
                  }
              }

              return new Options(data);
          }

          /**
           * Return an options object with the given style. If `this.style === style`,
           * returns `this`.
           */

      }, {
          key: "havingStyle",
          value: function havingStyle(style) {
              if (this.style === style) {
                  return this;
              } else {
                  return this.extend({
                      style: style,
                      size: sizeAtStyle(this.textSize, style)
                  });
              }
          }

          /**
           * Return an options object with a cramped version of the current style. If
           * the current style is cramped, returns `this`.
           */

      }, {
          key: "havingCrampedStyle",
          value: function havingCrampedStyle() {
              return this.havingStyle(this.style.cramp());
          }

          /**
           * Return an options object with the given size and in at least `\textstyle`.
           * Returns `this` if appropriate.
           */

      }, {
          key: "havingSize",
          value: function havingSize(size) {
              if (this.size === size && this.textSize === size) {
                  return this;
              } else {
                  return this.extend({
                      style: this.style.text(),
                      size: size,
                      textSize: size
                  });
              }
          }

          /**
           * Like `this.havingSize(BASESIZE).havingStyle(style)`. If `style` is omitted,
           * changes to at least `\textstyle`.
           */

      }, {
          key: "havingBaseStyle",
          value: function havingBaseStyle(style) {
              style = style || this.style.text();
              var wantSize = sizeAtStyle(BASESIZE, style);
              if (this.size === wantSize && this.textSize === BASESIZE && this.style === style) {
                  return this;
              } else {
                  return this.extend({
                      style: style,
                      size: wantSize,
                      baseSize: BASESIZE
                  });
              }
          }

          /**
           * Create a new options object with the given color.
           */

      }, {
          key: "withColor",
          value: function withColor(color) {
              return this.extend({
                  color: color
              });
          }

          /**
           * Create a new options object with "phantom" set to true.
           */

      }, {
          key: "withPhantom",
          value: function withPhantom() {
              return this.extend({
                  phantom: true
              });
          }

          /**
           * Create a new options objects with the give font.
           */

      }, {
          key: "withFont",
          value: function withFont(font) {
              return this.extend({
                  font: font || this.font
              });
          }

          /**
           * Return the CSS sizing classes required to switch from enclosing options
           * `oldOptions` to `this`. Returns an array of classes.
           */

      }, {
          key: "sizingClasses",
          value: function sizingClasses(oldOptions) {
              if (oldOptions.size !== this.size) {
                  return ["sizing", "reset-size" + oldOptions.size, "size" + this.size];
              } else {
                  return [];
              }
          }

          /**
           * Return the CSS sizing classes required to switch to the base size. Like
           * `this.havingSize(BASESIZE).sizingClasses(this)`.
           */

      }, {
          key: "baseSizingClasses",
          value: function baseSizingClasses() {
              if (this.size !== BASESIZE) {
                  return ["sizing", "reset-size" + this.size, "size" + BASESIZE];
              } else {
                  return [];
              }
          }

          /**
           * Return the font metrics for this size.
           */

      }, {
          key: "fontMetrics",
          value: function fontMetrics() {
              if (!this._fontMetrics) {
                  this._fontMetrics = _fontMetrics3.default.getFontMetrics(this.size);
              }
              return this._fontMetrics;
          }

          /**
           * A map of color names to CSS colors.
           * TODO(emily): Remove this when we have real macros
           */

      }, {
          key: "getColor",


          /**
           * Gets the CSS color of the current options object, accounting for the
           * `colorMap`.
           */
          value: function getColor() {
              if (this.phantom) {
                  return "transparent";
              } else {
                  return Options.colorMap[this.color] || this.color;
              }
          }
      }]);
      return Options;
  }();

  /**
   * The base size index.
   */


  Options.colorMap = {
      "katex-blue": "#6495ed",
      "katex-orange": "#ffa500",
      "katex-pink": "#ff00af",
      "katex-red": "#df0030",
      "katex-green": "#28ae7b",
      "katex-gray": "gray",
      "katex-purple": "#9d38bd",
      "katex-blueA": "#ccfaff",
      "katex-blueB": "#80f6ff",
      "katex-blueC": "#63d9ea",
      "katex-blueD": "#11accd",
      "katex-blueE": "#0c7f99",
      "katex-tealA": "#94fff5",
      "katex-tealB": "#26edd5",
      "katex-tealC": "#01d1c1",
      "katex-tealD": "#01a995",
      "katex-tealE": "#208170",
      "katex-greenA": "#b6ffb0",
      "katex-greenB": "#8af281",
      "katex-greenC": "#74cf70",
      "katex-greenD": "#1fab54",
      "katex-greenE": "#0d923f",
      "katex-goldA": "#ffd0a9",
      "katex-goldB": "#ffbb71",
      