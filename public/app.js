(() => {
  "use strict";

  const STORAGE_KEY = "study-grove-adaptive-tutor-v1";
  const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
  const MODEL_MODULE_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";
  const SESSION_LIMIT = 10;
  const DEFAULT_MASTERY = 50;
  const DIFFICULTY_THRESHOLDS = { easyBelow: 40, mediumBelow: 70 };
  const RESULT_THRESHOLDS = { correct: 70, partial: 45 };
  const MASTERY_CHANGE = { Correct: 10, "Partially Correct": 3, Incorrect: -10 };
  const STOPWORDS = new Set(("a an the and or but to of in on at from by for with as is are was were be been being it its this that these those when why how what does do can could should would will may might model learns learned learning data training test unseen new poor performs performance patterns noise generalize generalization using use used into through than then their them they you your about between different more most less very also not only based task method technique system value values model's" ).split(/\s+/));

  let questions = [];
  let concepts = [];
  let semanticExtractor = null;
  let semanticInitPromise = null;
  let answerVectorCache = new Map();
  let toastTimeout = null;
  let state = null;

  const $ = (id) => document.getElementById(id);
  const el = {
    start: $("start-session"), emptyStart: $("empty-start"), restart: $("restart-session"),
    empty: $("session-empty"), questionArea: $("question-area"), complete: $("session-complete"),
    studyMode: $("study-mode"), sessionIndex: $("session-index"), progressFill: $("session-progress-fill"),
    concept: $("question-concept"), difficulty: $("question-difficulty"), questionNumber: $("question-number"),
    questionText: $("question-text"), answerForm: $("answer-form"), answer: $("student-answer"), check: $("check-answer"),
    charCount: $("char-count"), result: $("answer-result"), resultClass: $("result-classification"), resultScore: $("result-score"),
    resultScoreLabel: $("result-score-label"), resultMethod: $("result-method"), resultFeedback: $("result-feedback"),
    referenceText: $("reference-answer-text"), resultMastery: $("result-mastery"), resultMasteryFill: $("result-mastery-fill"),
    next: $("next-question"), end: $("end-session"), engineStatus: $("engine-status"), engineDot: $("engine-dot"),
    masteryList: $("mastery-list"), focusList: $("focus-list"), focusIntro: $("focus-intro"),
    statAttempts: $("stat-attempts"), statAccuracy: $("stat-accuracy"), statAverage: $("stat-average"), statStrong: $("stat-strong"),
    historyEmpty: $("history-empty"), historyList: $("history-list"), downloadCsv: $("download-csv"), downloadJson: $("download-json"),
    reset: $("reset-progress"), toast: $("toast"), sessionSummary: $("session-summary"), completeCount: $("complete-count"),
    completeAverage: $("complete-average"), completeMastery: $("complete-mastery"), questionCount: $("question-count")
  };

  function emptyProfile() {
    const profile = {};
    concepts.forEach((concept) => { profile[concept] = { mastery: DEFAULT_MASTERY, attempts: 0, correct: 0, incorrect: 0, partial: 0 }; });
    return profile;
  }

  function defaultState() {
    return {
      student_profile: emptyProfile(),
      progress_history: [],
      asked_ids: [],
      session: { active: false, complete: false, answered: 0, limit: SESSION_LIMIT, current_id: null, mode: "adaptive", concept: concepts[0] || "Overfitting", session_start_index: 0, session_history_start: 0 }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      const profile = emptyProfile();
      concepts.forEach((concept) => {
        if (parsed.student_profile && parsed.student_profile[concept]) {
          profile[concept] = { ...profile[concept], ...parsed.student_profile[concept] };
          profile[concept].mastery = clamp(Number(profile[concept].mastery) || 0, 0, 100);
        }
      });
      base.student_profile = profile;
      base.progress_history = Array.isArray(parsed.progress_history) ? parsed.progress_history.slice(-2000) : [];
      base.asked_ids = Array.isArray(parsed.asked_ids) ? parsed.asked_ids : [];
      base.session = { ...base.session, ...(parsed.session || {}) };
      if (!concepts.includes(base.session.concept)) base.session.concept = concepts[0] || "Overfitting";
      return base;
    } catch (error) {
      console.warn("Could not read the saved tutor profile; starting a clean profile.", error);
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("Browser storage is unavailable.", error);
      showToast("Browser storage is unavailable. Export your progress to keep a copy.");
      return false;
    }
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function formatNumber(value, digits = 1) { return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—"; }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }
  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("visible");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.toast.classList.remove("visible"), 3400);
  }
  function setEngineStatus(text, mode = "loading") {
    el.engineStatus.textContent = text;
    el.engineDot.classList.toggle("is-loading", mode === "loading");
    el.engineDot.classList.toggle("is-error", mode === "fallback");
  }

  async function initialize() {
    try {
      const response = await fetch("/data/question_bank.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`Question library returned HTTP ${response.status}`);
      questions = await response.json();
      if (!Array.isArray(questions) || questions.length === 0) throw new Error("The question library is empty.");
      concepts = [...new Set(questions.map((q) => q.concept))];
      state = loadState();
      populateConceptSelect();
      el.questionCount.textContent = String(questions.length);
      bindEvents();
      renderDashboard();
      renderQuestionFromSession();
      initSemanticModel();
    } catch (error) {
      console.error(error);
      setEngineStatus("Library could not load", "fallback");
      const empty = $("session-empty");
      empty.hidden = false;
      empty.innerHTML = `<h3>Field notes unavailable</h3><p>${escapeHtml(error.message)} Please confirm <code>public/data/question_bank.json</code> is included in the deployed site.</p>`;
    }
  }

  function populateConceptSelect() {
    concepts.forEach((concept) => {
      const option = document.createElement("option");
      option.value = concept;
      option.textContent = `Practice: ${concept}`;
      el.studyMode.appendChild(option);
    });
    el.studyMode.value = state.session.mode === "adaptive" ? "adaptive" : state.session.concept;
  }

  async function initSemanticModel() {
    if (semanticInitPromise) return semanticInitPromise;
    semanticInitPromise = (async () => {
      try {
        setEngineStatus("Loading semantic model…", "loading");
        const module = await import(MODEL_MODULE_URL);
        semanticExtractor = await module.pipeline("feature-extraction", MODEL_ID, {
          dtype: "q8",
          progress_callback: (progress) => {
            if (progress && progress.status === "progress" && typeof progress.progress === "number") {
              setEngineStatus(`Loading model ${Math.round(progress.progress)}%…`, "loading");
            }
          }
        });
        setEngineStatus("Semantic model ready", "ready");
        showToast("Semantic answer evaluation is ready.");
      } catch (error) {
        console.warn("Browser semantic model unavailable; using the clearly labelled lexical fallback.", error);
        semanticExtractor = null;
        setEngineStatus("Keyword fallback available", "fallback");
      }
      return semanticExtractor;
    })();
    return semanticInitPromise;
  }

  function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i += 1) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async function embeddingFor(text) {
    const tensor = await semanticExtractor(text, { pooling: "mean", normalize: true });
    return Array.from(tensor.data);
  }

  async function scoreAnswer(studentAnswer, referenceAnswer, questionId) {
    const answer = studentAnswer.trim();
    if (semanticExtractor) {
      try {
        let refVec = answerVectorCache.get(questionId);
        if (!refVec) {
          refVec = await embeddingFor(referenceAnswer);
          answerVectorCache.set(questionId, refVec);
        }
        const studentVec = await embeddingFor(answer);
        return { score: cosineSimilarity(studentVec, refVec) * 100, method: "Semantic model", explanation: "Sentence embeddings compare the meaning of your explanation with the reference answer. Similarity is a guide, not a calibrated probability." };
      } catch (error) {
        console.warn("Semantic inference failed for this answer; falling back to lexical scoring.", error);
      }
    }
    return { score: lexicalF1(answer, referenceAnswer), method: "Keyword fallback", explanation: "The semantic model is not available in this browser session, so this score uses content-word overlap. It is a rough fallback and may miss correct explanations phrased differently." };
  }

  function tokenize(text) {
    return String(text || "").toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g)?.filter((token) => token.length > 2 && !STOPWORDS.has(token)) || [];
  }
  function lexicalF1(studentText, referenceText) {
    const student = tokenize(studentText);
    const reference = tokenize(referenceText);
    if (!student.length || !reference.length) return 0;
    const studentCounts = new Map();
    student.forEach((token) => studentCounts.set(token, (studentCounts.get(token) || 0) + 1));
    const referenceCounts = new Map();
    reference.forEach((token) => referenceCounts.set(token, (referenceCounts.get(token) || 0) + 1));
    let overlap = 0;
    studentCounts.forEach((count, token) => { overlap += Math.min(count, referenceCounts.get(token) || 0); });
    const precision = overlap / student.length;
    const recall = overlap / reference.length;
    return precision + recall === 0 ? 0 : (2 * precision * recall / (precision + recall)) * 100;
  }

  function classifyAnswer(score) {
    if (score >= RESULT_THRESHOLDS.correct) return "Correct";
    if (score >= RESULT_THRESHOLDS.partial) return "Partially Correct";
    return "Incorrect";
  }
  function determineDifficulty(concept) {
    const mastery = state.student_profile[concept].mastery;
    if (mastery < DIFFICULTY_THRESHOLDS.easyBelow) return "Easy";
    if (mastery < DIFFICULTY_THRESHOLDS.mediumBelow) return "Medium";
    return "Hard";
  }
  function calculatePriority(concept) {
    const profile = state.student_profile[concept];
    return (100 - profile.mastery) + (profile.attempts === 0 ? 20 : 0);
  }
  function selectTargetConcept() {
    if (state.session.mode !== "adaptive" && concepts.includes(state.session.concept)) return state.session.concept;
    let winner = concepts[0];
    let best = -Infinity;
    concepts.forEach((concept) => {
      const score = calculatePriority(concept);
      if (score > best) { best = score; winner = concept; }
    });
    return winner;
  }
  function selectNextQuestion() {
    const targetConcept = selectTargetConcept();
    const difficulty = determineDifficulty(targetConcept);
    const asked = new Set(state.asked_ids);
    let candidates = questions.filter((q) => q.concept === targetConcept && q.difficulty === difficulty && !asked.has(q.id));
    if (!candidates.length) candidates = questions.filter((q) => q.concept === targetConcept && !asked.has(q.id));
    if (!candidates.length) candidates = questions.filter((q) => q.concept === targetConcept);
    if (!candidates.length) candidates = questions;
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    state.asked_ids.push(selected.id);
    state.session.current_id = selected.id;
    state.session.concept = selected.concept;
    saveState();
    return selected;
  }
  function findCurrentQuestion() { return questions.find((q) => q.id === state.session.current_id) || null; }

  function startSession() {
    if (!state) return;
    state.session.active = true;
    state.session.complete = false;
    state.session.answered = 0;
    state.session.limit = SESSION_LIMIT;
    state.session.current_id = null;
    state.session.mode = el.studyMode.value === "adaptive" ? "adaptive" : el.studyMode.value;
    if (state.session.mode !== "adaptive") state.session.concept = state.session.mode;
    state.session.session_start_index = state.progress_history.length;
    state.session.session_history_start = state.progress_history.length;
    saveState();
    displaySessionEmpty(false);
    displayComplete(false);
    renderQuestion(selectNextQuestion());
    renderDashboard();
    $("study-title").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function displaySessionEmpty(show) { el.empty.hidden = !show; }
  function displayComplete(show) { el.complete.hidden = !show; }
  function renderQuestionFromSession() {
    el.start.hidden = !!state.session.active;
    if (state.session.complete) { displaySessionEmpty(false); el.questionArea.hidden = true; displayComplete(true); renderCompletion(); return; }
    if (state.session.active) {
      displaySessionEmpty(false);
      displayComplete(false);
      const current = findCurrentQuestion();
      if (current && state.session.answered < state.session.limit) renderQuestion(current);
      else renderQuestion(selectNextQuestion());
    } else {
      displaySessionEmpty(true);
      el.questionArea.hidden = true;
      displayComplete(false);
      updateSessionProgress();
    }
  }
  function renderQuestion(question) {
    displaySessionEmpty(false);
    displayComplete(false);
    el.start.hidden = true;
    el.questionArea.hidden = false;
    el.result.hidden = true;
    el.answerForm.hidden = false;
    el.answer.disabled = false;
    el.check.disabled = false;
    el.check.textContent = "Check my answer ↗";
    el.answer.value = "";
    el.charCount.textContent = "0 / 2500";
    el.concept.textContent = question.concept;
    el.difficulty.textContent = question.difficulty.toUpperCase();
    el.questionNumber.textContent = `CARD ${String(question.id).padStart(2, "0")}`;
    el.questionText.textContent = question.question;
    el.next.hidden = true;
    el.end.hidden = true;
    el.sessionIndex.textContent = `${Math.min(state.session.answered + 1, SESSION_LIMIT)} / ${SESSION_LIMIT}`;
    updateSessionProgress();
    saveState();
  }
  function updateSessionProgress() {
    const count = state?.session?.answered || 0;
    el.progressFill.style.width = `${clamp((count / SESSION_LIMIT) * 100, 0, 100)}%`;
    if (!state?.session?.active) el.sessionIndex.textContent = "—";
  }

  async function handleAnswerSubmit(event) {
    event.preventDefault();
    const current = findCurrentQuestion();
    const studentAnswer = el.answer.value.trim();
    if (!current) { showToast("Start a session to open a question."); return; }
    if (!studentAnswer) { el.answer.focus(); showToast("Write a short explanation before checking it."); return; }
    el.check.disabled = true;
    el.check.textContent = "Checking…";
    try {
      const result = await scoreAnswer(studentAnswer, current.answer, current.id);
      const score = Number.isFinite(result.score) ? result.score : 0;
      const evaluation = classifyAnswer(score);
      const profile = state.student_profile[current.concept];
      profile.attempts += 1;
      if (evaluation === "Correct") profile.correct += 1;
      else if (evaluation === "Partially Correct") profile.partial += 1;
      else profile.incorrect += 1;
      profile.mastery = clamp(profile.mastery + MASTERY_CHANGE[evaluation], 0, 100);
      const record = {
        timestamp: new Date().toISOString(),
        question_id: current.id,
        question: current.question,
        concept: current.concept,
        difficulty: current.difficulty,
        student_answer: studentAnswer,
        reference_answer: current.answer,
        score: Math.round(score * 100) / 100,
        evaluation,
        scoring_method: result.method,
        mastery: Math.round(profile.mastery * 100) / 100,
        concept_attempts: profile.attempts
      };
      state.progress_history.push(record);
      state.session.answered += 1;
      state.session.current_id = current.id;
      saveState();
      renderAnswerResult(result, evaluation, current, profile);
      renderDashboard();
      el.answerForm.hidden = true;
      el.result.hidden = false;
      el.next.hidden = false;
      el.end.hidden = false;
      el.next.textContent = state.session.answered >= state.session.limit ? "Finish session →" : "Next question →";
      el.sessionIndex.textContent = `${Math.min(state.session.answered, SESSION_LIMIT)} / ${SESSION_LIMIT}`;
      updateSessionProgress();
      if (result.method !== "Semantic model") setEngineStatus("Keyword fallback active", "fallback");
    } catch (error) {
      console.error(error);
      showToast("The answer could not be scored. Please try again.");
      el.check.disabled = false;
      el.check.textContent = "Check my answer ↗";
    }
  }

  function renderAnswerResult(result, evaluation, question, profile) {
    el.resultClass.textContent = evaluation.toUpperCase();
    el.resultClass.className = "result-badge" + (evaluation === "Partially Correct" ? " partial" : evaluation === "Incorrect" ? " incorrect" : "");
    el.resultScore.textContent = formatNumber(result.score, 1);
    el.resultScoreLabel.textContent = "SIMILARITY SCORE";
    el.resultMethod.textContent = result.method;
    const intro = evaluation === "Correct"
      ? "Your explanation is close to the reference answer. Keep practising to make the understanding stick."
      : evaluation === "Partially Correct"
        ? "Some ideas overlap with the reference. Compare the wording below and look for the central point you may have missed."
        : "This response did not match enough of the reference answer yet. Read the example, then try to explain the concept again in your own words in a later round.";
    el.resultFeedback.textContent = `${intro} ${result.explanation}`;
    el.referenceText.textContent = question.answer;
    el.resultMastery.textContent = `${Math.round(profile.mastery)}%`;
    el.resultMasteryFill.style.width = `${clamp(profile.mastery, 0, 100)}%`;
  }

  function goNextQuestion() {
    if (!state.session.active) return;
    if (state.session.answered >= state.session.limit) { finishSession(); return; }
    const next = selectNextQuestion();
    renderQuestion(next);
    renderDashboard();
  }
  function finishSession() {
    state.session.active = false;
    state.session.complete = true;
    state.session.current_id = null;
    saveState();
    el.start.hidden = true;
    el.questionArea.hidden = true;
    displaySessionEmpty(false);
    displayComplete(true);
    renderCompletion();
    renderDashboard();
  }
  function endSessionEarly() {
    if (state.session.answered === 0) {
      state.session.active = false;
      state.session.current_id = null;
      saveState();
      el.questionArea.hidden = true;
      displaySessionEmpty(true);
      el.start.hidden = false;
      updateSessionProgress();
      return;
    }
    finishSession();
  }
  function renderCompletion() {
    const startIndex = Number(state.session.session_history_start || 0);
    const sessionRecords = state.progress_history.slice(startIndex);
    const avg = sessionRecords.length ? sessionRecords.reduce((sum, record) => sum + Number(record.score || 0), 0) / sessionRecords.length : NaN;
    const latestConcepts = [...new Set(sessionRecords.map((record) => record.concept))];
    const avgMastery = latestConcepts.length ? latestConcepts.reduce((sum, concept) => sum + state.student_profile[concept].mastery, 0) / latestConcepts.length : NaN;
    el.completeCount.textContent = String(sessionRecords.length);
    el.completeAverage.textContent = Number.isFinite(avg) ? `${formatNumber(avg, 1)}` : "—";
    el.completeMastery.textContent = Number.isFinite(avgMastery) ? `${Math.round(avgMastery)}%` : "—";
    el.sessionSummary.textContent = sessionRecords.length
      ? `You completed ${sessionRecords.length} question${sessionRecords.length === 1 ? "" : "s"}. Take a moment to review the concepts that still need another pass.`
      : "No answers were recorded this time. Start a new session whenever you're ready.";
  }

  function renderDashboard() {
    if (!state) return;
    const history = state.progress_history;
    const total = history.length;
    const correct = history.filter((row) => row.evaluation === "Correct").length;
    const average = total ? history.reduce((sum, row) => sum + Number(row.score || 0), 0) / total : NaN;
    const strong = concepts.filter((concept) => state.student_profile[concept].mastery >= 70).length;
    el.statAttempts.textContent = String(total);
    el.statAccuracy.textContent = total ? `${Math.round((correct / total) * 100)}%` : "—";
    el.statAverage.textContent = Number.isFinite(average) ? `${formatNumber(average, 1)}` : "—";
    el.statStrong.innerHTML = `${strong}<span class="stat-unit"> / ${concepts.length}</span>`;
    renderMasteryList();
    renderFocusList();
    renderHistory();
    updateSessionProgress();
    if (!state.session.active && !state.session.complete) el.start.hidden = false;
  }

  function masteryStatus(score) {
    if (score >= 70) return "Strong footing";
    if (score >= 40) return "Still growing";
    return "Needs a gentle revisit";
  }
  function renderMasteryList() {
    el.masteryList.innerHTML = concepts.map((concept) => {
      const score = clamp(Number(state.student_profile[concept].mastery) || 0, 0, 100);
      const barClass = score < 40 ? "low" : score < 70 ? "mid" : "";
      return `<div class="mastery-row"><span class="mastery-name">${escapeHtml(concept)}</span><span class="mastery-percent">${Math.round(score)}%</span><div class="mastery-meter"><span class="${barClass}" style="width:${score}%"></span></div><span class="mastery-status">${escapeHtml(masteryStatus(score))}</span></div>`;
    }).join("");
  }
  function renderFocusList() {
    const ranked = concepts.map((concept) => ({ concept, mastery: state.student_profile[concept].mastery, attempts: state.student_profile[concept].attempts, priority: calculatePriority(concept) }))
      .sort((a, b) => b.priority - a.priority);
    const weak = ranked.filter((item) => item.mastery < 60).slice(0, 3);
    el.focusList.innerHTML = "";
    if (!state.progress_history.length) {
      el.focusIntro.textContent = "The tutor will suggest a concept as you practise. New or low-mastery ideas receive extra attention.";
      const li = document.createElement("li"); li.textContent = "Complete a question to start your notes."; el.focusList.appendChild(li); return;
    }
    el.focusIntro.textContent = "These ideas are good candidates for another pass, ordered by the tutor's priority rule.";
    const items = weak.length ? weak : ranked.slice(0, 3);
    items.forEach((item) => {
      const li = document.createElement("li");
      const name = document.createElement("span"); name.textContent = item.concept;
      const score = document.createElement("span"); score.className = "focus-score"; score.textContent = `${Math.round(item.mastery)}% mastery`;
      li.append(name, score); el.focusList.appendChild(li);
    });
  }
  function renderHistory() {
    const records = state.progress_history.slice(-6).reverse();
    el.historyList.innerHTML = "";
    el.historyEmpty.hidden = records.length > 0;
    records.forEach((record, index) => {
      const row = document.createElement("div"); row.className = "history-row";
      const number = document.createElement("span"); number.className = "history-index"; number.textContent = `#${String(state.progress_history.length - index).padStart(3, "0")}`;
      const main = document.createElement("div");
      const question = document.createElement("div"); question.className = "history-question"; question.textContent = record.question || `Question ${record.question_id}`;
      const meta = document.createElement("div"); meta.className = "history-meta"; meta.textContent = `${record.concept} · ${record.difficulty} · ${new Date(record.timestamp || Date.now()).toLocaleDateString()}`;
      main.append(question, meta);
      const score = document.createElement("span"); score.className = "history-score"; score.textContent = `${formatNumber(record.score, 1)} pts`;
      const result = document.createElement("span"); result.className = "history-result" + (record.evaluation === "Partially Correct" ? " partial" : record.evaluation === "Incorrect" ? " incorrect" : ""); result.textContent = record.evaluation;
      row.append(number, main, score, result); el.historyList.appendChild(row);
    });
  }

  function downloadBlob(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportJson() {
    const payload = { exported_at: new Date().toISOString(), app: "Study Grove — Adaptive AI Tutor", scoring: "Browser semantic similarity where available; labelled lexical F1 fallback otherwise.", student_profile: state.student_profile, progress_history: state.progress_history };
    downloadBlob("study-grove-progress.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    showToast("Your learning journal has been exported as JSON.");
  }
  function csvCell(value) { const text = String(value ?? ""); return `"${text.replace(/"/g, '""')}"`; }
  function exportCsv() {
    if (!state.progress_history.length) { showToast("There are no attempts to export yet."); return; }
    const columns = ["timestamp", "question_id", "question", "concept", "difficulty", "student_answer", "reference_answer", "score", "evaluation", "scoring_method", "mastery", "concept_attempts"];
    const rows = [columns.map(csvCell).join(","), ...state.progress_history.map((record) => columns.map((key) => csvCell(record[key])).join(","))];
    downloadBlob("study-grove-progress.csv", rows.join("\r\n"), "text/csv;charset=utf-8");
    showToast("Your learning journal has been exported as CSV.");
  }
  function resetProgress() {
    const confirmed = window.confirm("Clear all saved mastery scores and attempt history on this browser? Export your journal first if you want to keep a copy.");
    if (!confirmed) return;
    state = defaultState();
    saveState();
    el.studyMode.value = "adaptive";
    renderDashboard();
    renderQuestionFromSession();
    showToast("Your local learning journal has been cleared.");
  }

  function bindEvents() {
    el.start.addEventListener("click", startSession);
    el.emptyStart.addEventListener("click", startSession);
    el.restart.addEventListener("click", startSession);
    el.answerForm.addEventListener("submit", handleAnswerSubmit);
    el.answer.addEventListener("input", () => { el.charCount.textContent = `${el.answer.value.length} / 2500`; });
    el.next.addEventListener("click", goNextQuestion);
    el.end.addEventListener("click", endSessionEarly);
    el.studyMode.addEventListener("change", () => {
      if (el.studyMode.value !== "adaptive") { state.session.mode = el.studyMode.value; state.session.concept = el.studyMode.value; }
      else state.session.mode = "adaptive";
      saveState();
    });
    el.downloadJson.addEventListener("click", exportJson);
    el.downloadCsv.addEventListener("click", exportCsv);
    el.reset.addEventListener("click", resetProgress);
    window.addEventListener("beforeunload", saveState);
  }

  initialize();
})();
