(() => {
  // Function to grab the HTML from the div with class "ng-star-inserted"
  function getDivHTML() {
    const targetDiv = document.querySelector('.ng-star-inserted');
    return targetDiv ? targetDiv.outerHTML : '';
  }

  // Split comma-separated values into array
  function splitCommaSeparated(input) {
    if (typeof input !== 'string') return [];
    return input
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  // Simple fuzzy match on word overlap
  function isFuzzyMatch(ans, optText) {
    const aWords = ans.split(/\s+/);
    const oWords = optText.split(/\s+/);
    const commonCount = aWords.filter(w => oWords.includes(w)).length;
    const minLen = Math.min(aWords.length, oWords.length);
    return minLen > 0 && (commonCount / minLen) >= 0.6;
  }

  // Function to send the HTML as a chat message
  async function sendChatMessage(content) {
    const apiUrl = 'https://ai.hackclub.com/chat/completions';
    const payload = JSON.stringify({
      messages: [{ role: 'user', content: content }]
    });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();
      console.log('Full response:', data);

      if (!data.choices || !data.choices.length) {
        console.log("No valid response received.");
        return;
      }

      const raw = data.choices[0].message.content;
      console.log("Raw JSON response:", raw);

      let answersObj;
      try {
        answersObj = JSON.parse(raw);
        console.log("Parsed answers object:", answersObj);
      } catch (err) {
        console.error("Error parsing JSON:", err, raw);
        return;
      }

      const sections = document.querySelectorAll("vo-eb-document");
      console.log("Found sections:", sections.length);

      // If only 1 or 2 questions total, treat them all as 'a'
      const useGenericKey = sections.length <= 2;

      sections.forEach((section, idx) => {
        console.log(`\n--- Processing section ${idx + 1} ---`);
        // Determine the question key
        let key = 'a';
        if (!useGenericKey) {
          const kEl = section.querySelector("p.instruction > span");
          if (!kEl) {
            console.log(`Section ${idx + 1}: no key found, skipping.`);
            return;
          }
          key = kEl.textContent.trim();
        }
        console.log(`Using key "${key}"`);

        let answer = answersObj[key];
        console.log(`Raw answer for "${key}":`, answer);
        const answerType = Array.isArray(answer) ? 'array' : typeof answer;
        console.log(`Answer type for "${key}":`, answerType);

        section.querySelector("p.instruction > span").textContent = answer + " " + key;

        // Handle open-ended questions (textarea)
        const openQ = section.querySelector("span > eb-editing > div > textarea");
        if (openQ) {
          console.log(`→ [open-ended] injecting into textarea`);
          if (Array.isArray(answer)) {
            openQ.value = answer.join(', ');
            console.log(`Injected array into textarea: "${openQ.value}"`);
          } else {
            openQ.value = String(answer);
            console.log(`Injected text into textarea: "${openQ.value}"`);
          }
          return;
        }
        // const mutlirandomwordclock = section.querySelectorAll("eb-cloze-content-block > eb-cloze-container.eb-id > p > eb-cloze-renderer");
        // if (mutlirandomwordclock){
        //   section.innerHTML = "<p>" + answer + "</p>" + section.innerHTML;
        // }
        //


        // Handle cloze dropdowns
        const clozes = section.querySelectorAll("eb-cloze-content-block > eb-cloze-container > p > eb-cloze-renderer");
        if (clozes.length) {
          console.log(`→ [cloze] setting ${clozes.length} dropdown(s)`);
          const parts = Array.isArray(answer) ? answer : splitCommaSeparated(String(answer));
          console.log(`Cloze parts array:`, parts);
          let offset = 0;
          clozes.forEach((renderer, i) => {
            const drop = renderer.querySelector("eb-cloze-drop > eb-select > span > span.eb-value > span");
            if (drop) {
              const text = parts[i - offset] || "";
              drop.innerHTML = text;
              console.log(` Set dropdown[${i}] = "${text}"`);
            } else {
              offset++;
            }
          });
          return;
        }

        // Handle checkboxes (multiple answers)
        if (section.querySelector("eb-choice-list ul li.eb-choice input[type='checkbox']")) {
          console.log(`→ [checkbox] trying multiple answers for "${key}"`);
          const ul = section.querySelector("eb-choice-list ul");
          const answersArr = Array.isArray(answer) ? answer : splitCommaSeparated(String(answer));
          console.log(`Answers array:`, answersArr);

          let matchedSomething = false;
          ul.querySelectorAll("li.eb-choice").forEach((opt, i) => {
            const txt = opt.textContent.trim().toLowerCase();
            const match = answersArr.some(ans => {
              const a = ans.toLowerCase();
              return a === txt || isFuzzyMatch(a, txt);
            });
            console.log(` Option[${i}] "${txt}" match?`, match);
            if (match) {
              const cb = opt.querySelector("input[type='checkbox']");
              if (cb) {
                cb.checked = true;
                cb.dispatchEvent(new Event("change", { bubbles: true }));
                console.log(`  ✓ Checked "${txt}"`);
                matchedSomething = true;
              }
            }
          });

          if (!matchedSomething) {
            const rawText = answersArr.join(', ');
            ul.insertAdjacentHTML('beforeend', `<li class="eb-choice eb-custom">${rawText}</li>`);
            console.warn(`⚠️ No matches – appended raw answer: "${rawText}"`);
          }
          return;
        }

        // Handle radio buttons (single choice)
        if (section.querySelector("eb-choice-list ul li.eb-choice input[type='radio']")) {
          console.log(`→ [radio] single-choice for "${key}"`);
          const desired = String(answer).trim().toLowerCase();
          console.log(` Desired radio value: "${desired}"`);
          section.querySelectorAll("eb-choice-list ul li.eb-choice").forEach((opt, i) => {
            const txt = opt.textContent.trim().toLowerCase();
            console.log(` Option[${i}] "${txt}"`);
            if (txt === desired) {
              const radio = opt.querySelector("input[type='radio']");
              if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event("change", { bubbles: true }));
                console.log(`  ✓ Selected "${txt}"`);
              }
            }
          });
          return;
        }

        console.log(`No matching input found for key "${key}".`);
      });
    } catch (e) {
      console.error('Error during API request:', e);
    }
  }

  // Improved extractor to clean up and dedupe text
  function extractImportantInfo(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('audio, video, script, style').forEach(el => el.remove());
    const nodes = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li');
    const out = [];
    nodes.forEach(n => {
      let t = n.textContent.trim();
      if (!t) return;
      if (/^\d{1,2}:\d{2}/.test(t)) return;
      if (/^(audio|video)$/i.test(t)) return;
      if (/Deze student heeft al feedback/i.test(t)) return;
      t = t.replace(/\s+/g, ' ');
      if (out[out.length-1] === t) return;
      out.push(t);
    });
    return out.join('\n\n');
  }

  const divHTML = extractImportantInfo(getDivHTML());
  console.log(divHTML);

  const promt =
    "I will now send you the HTML content extracted from the div with the class 'ng-star-inserted' from the 'taalblokken' website. " +
    "Taalblokken is a learning website for students. Your task is to analyze the HTML and extract the answers to the questions it contains. " +
    "\n\nFor each question:" +
    "\n - If the question is open-ended or single-choice, provide the answer as a simple text string." +
    "\n - For open-ended (textarea) questions, write a detailed, complete answer in one or two full sentences that directly addresses everything the question asks for." +
    "\n - Some answers may contain multiple parts; in those cases, output them as an array of strings." +
    "\n\n**IMPORTANT EXTRA RULE:**" +
    "\n - Whenever the answer you receive is a single comma-separated string (e.g. \"foo, bar, baz\") or a repeated phrase with commas, split on commas, strip any leading context, and keep only the actual tokens in order." +
    "\n   • Example: \"kop: ja, opmaak: ja, info: ja\" → [\"ja\",\"ja\",\"ja\"]." +
    "\n\nAdditional rules:" +
    "\n - For question 'a' (Beoordeel tekst 2 op betrouwbaarheid), output exactly four elements: [bron betrouwbaar?, auteur expertise?, up-to-date?, feiten?]." +
    "\n - Only use the provided text; do not invent information." +
    "\n - For multiple-choice, choose one of the given options." +
    "\n - Output keys in alphabetical order (a, b, c…) without skipping or duplicating." +
    "\n\n**NO extra formatting:** output only the raw JSON object, with no markdown or backticks.";

  sendChatMessage(promt + divHTML);
})();
