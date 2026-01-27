export default {
  // Estado (respostas em memória)
  answers: {},

  // 1) Obter todas as perguntas do domínio "Social"
  getQuestions() {
    const data = Qry_getQuestions.data || [];
    return data.filter(
      (q) => String(q.dominio || "").trim().toLowerCase() === "social"
    );
  },

  // 2) Filtrar perguntas com base nos widgets (condicionalidades)
  filterQuestions() {
    const all = this.getQuestions();
    if (!all.length) return [];

    // Helpers para ler "S"/"N" com segurança
    const norm = (v) => String(v ?? "").trim().toUpperCase();
    const isS = (row, col) => norm(row?.[col]) === "S";
    const isN = (row, col) => norm(row?.[col]) === "N";

    // Widgets (seleções dos filtros) — mantidos como no módulo "ambiental"
    const selectedCert = Multiselect_Certificacao?.selectedOptionValues || [];
    const selectedSP = Multiselect_SistemaProducao?.selectedOptionValues || [];
    const selectedDE = Select_Dimensao?.selectedOptionValue
      ? [Select_Dimensao.selectedOptionValue]
      : [];
    const selectedMO = Multiselect_MaoDeObra?.selectedOptionValues || [];

    const opSel = Select_OP?.selectedOptionValue; // "op_sim" | "op_nao"
    const proxSel = Select_ProxResidencias?.selectedOptionValue; // "prox_residencias_sim" | "prox_residencias_nao"
    const fitoSel = Select_Fitofarmaceuticos?.selectedOptionValue; // "fitofarmaceuticos_sim" | "fitofarmaceuticos_nao"
    const aguasSel = Select_AguasResiduais?.selectedOptionValue; // "aguas_residuais_sim" | "aguas_residuais_nao"
    const energiaSel = Select_ConsumoEnergetico?.selectedOptionValue; // "consumo_energetico_sim" | "consumo_energetico_nao"

    const selectedBinaryCols = [
      opSel,
      proxSel,
      fitoSel,
      aguasSel,
      energiaSel,
    ].filter(Boolean);

    // "Outros filtros" são obrigatórios: todos os grupos têm de ter pelo menos uma seleção
    const allOtherGroupsSelected =
      selectedSP.length > 0 &&
      selectedDE.length > 0 &&
      selectedMO.length > 0 &&
      selectedBinaryCols.length > 0;

    if (!allOtherGroupsSelected) return [];

    return all.filter((q) => {
      // --- Certificações ---
      const hasCertN = selectedCert.some((col) => isN(q, col));
      if (hasCertN) return false;
      // Regra permissiva: sem certificações selecionadas é OK; se houver, não pode ter "N"
      const certOK = selectedCert.length === 0 ? true : !hasCertN;

      // --- Outros filtros ---
      const spOK = selectedSP.some((col) => isS(q, col));
      const deOK = selectedDE.every((col) => isS(q, col));
      const moOK = selectedMO.some((col) => isS(q, col));
      const binOK = selectedBinaryCols.every((col) => isS(q, col));
      const otherOK = spOK && deOK && moOK && binOK;

      return certOK && otherOK;
    });
  },

  // 2.1) Todas as perguntas filtradas (sem condicionalidades de resposta)
  getAllFilteredQuestions() {
    return this.filterQuestions();
  },

  // 3) Ordenação por condicionalidade com base nas respostas dadas
  getVisibleQuestions() {
    const all = this.filterQuestions();
    const answers = this.answers || {};
    if (!all.length) return [];

    const byId = Object.fromEntries(all.map((q) => [String(q.id_pergunta), q]));

    const visible = [];
    const visited = new Set();
    let currentIndex = 0;

    while (currentIndex < all.length) {
      const current = all[currentIndex];
      const id = String(current.id_pergunta);

      if (visited.has(id)) break; // proteção contra loops
      visited.add(id);
      visible.push(current);

      const ans = answers[id];
      let nextId = null;

      if (ans === "Sim" && current.condicao_sim) nextId = current.condicao_sim;
      else if (ans === "Não" && current.condicao_nao) nextId = current.condicao_nao;
      else if (ans === "NA" && current.condicao_na) nextId = current.condicao_na;

      const nextIndex =
        nextId && byId[nextId]
          ? all.findIndex((q) => String(q.id_pergunta) === String(nextId))
          : -1;

      if (nextIndex >= 0 && nextIndex !== currentIndex) {
        currentIndex = nextIndex;
      } else {
        currentIndex++;
      }
    }

    return visible;
  },

  // 4) Label da pergunta (sem traços antes/depois do título)
  questionLabel: (row) =>
    row ? `${row.id_pergunta || ""} ${row.pergunta || ""}` : "",

  // 5) Opções do Radio
  radioOptions(row) {
    const options = [
      { label: "Sim", value: "Sim" },
      { label: "Não", value: "Não" },
    ];
    if (row.na === "S") {
      options.unshift({ label: "NA", value: "NA" });
    }
    return options;
  },

  // 6) Valor selecionado no Radio
  selectedValue(row) {
    return this.answers?.[row.id_pergunta] || "";
  },

  // 7) Handler de mudança de seleção
  onSelectionChange(row, selectedValue) {
    if (!row) return;
    this.answers = {
      ...this.answers,
      [String(row.id_pergunta)]: selectedValue,
    };
  },

  // 8) Preparar respostas para guardar
  prepareAnswers({ onlyVisible = true } = {}) {
    const questions = onlyVisible
      ? this.getVisibleQuestions()
      : this.getAllFilteredQuestions();

    const userId = appsmith.store.autenticacao?.nif || "unknown_user";
    const year = new Date().getFullYear();
    const answers = this.answers || {};
    const dominio = "social";

    return questions.map((q) => {
      const idPerg = String(q.id_pergunta);
      const currentAns = answers[idPerg];
      const respostaFinal = currentAns ? String(currentAns).trim() : null;

      return {
        id_resposta: `${userId}_${year}_${idPerg}`,
        id_pergunta: idPerg,
        id_utilizador: userId,
        resposta: respostaFinal,
        ano: year,
        dominio,
      };
    });
  },

  // 9) Construir VALUES para o INSERT (inclui validacao='N' para novas linhas)
  buildValues({ onlyVisible = true } = {}) {
    const prepared = this.prepareAnswers({ onlyVisible });
    if (!prepared.length) return "";

    return prepared
      .map((ans) => {
        const safeVal =
          ans.resposta === null
            ? "NULL"
            : `'${String(ans.resposta).replace(/'/g, "''")}'`;
        return `(
          '${ans.id_resposta}',
          '${ans.id_pergunta}',
          '${ans.id_utilizador}',
          ${safeVal},
          NOW(),
          ${ans.ano},
          '${ans.dominio}',
          'N'
        )`;
      })
      .join(", ");
  },

  // 11) Submissão
  async onSubmit() {
    try {
      await Qry_checkExistingSocial.run();
      const hasExisting =
        Array.isArray(Qry_checkExistingSocial.data) &&
        Qry_checkExistingSocial.data.length > 0;

      if (hasExisting) {
        showModal("Modal_ConfirmSocial");
        return;
      }

      await Qry_saveAnswersSocial.run();

      if (typeof Qry_getAnswersSocial?.run === "function") {
        await Qry_getAnswersSocial.run();
      }

      showAlert("Respostas do domínio social submetidas com sucesso!", "success");
    } catch (e) {
      console.error("Erro em onSubmit (social):", e);
      showAlert("Ocorreu um erro ao submeter. Tenta novamente.", "error");
    }
  },

  // 12) Confirmar substituição
  async confirmReplace() {
    try {
      await Qry_saveAnswersSocial.run();

      if (typeof Qry_getAnswersSocial?.run === "function") {
        await Qry_getAnswersSocial.run();
      }

      closeModal("Modal_ConfirmSocial");

      if (this.isFormPersistedCompletely()) {
        showAlert("Formulário completo. Respostas substituídas com sucesso!", "success");
      } else {
        showAlert(
          "Respostas substituídas. Existem ainda perguntas visíveis sem resposta na BD.",
          "info"
        );
      }
    } catch (e) {
      console.error("Erro em confirmReplace (social):", e);
      showAlert("Ocorreu um erro ao substituir. Tenta novamente.", "error");
    }
  },

  // 13) Cancelar substituição
  cancelReplace() {
    closeModal("Modal_ConfirmSocial");
    showAlert("Substituição cancelada.", "info");
  },

  // 14) Carregar respostas anteriores
  loadPreviousAnswers() {
    const data = Qry_getAnswersSocial.data || [];
    const mapped = {};
    data.forEach((row) => {
      if (row.id_pergunta && row.resposta != null) {
        mapped[String(row.id_pergunta)] = String(row.resposta).trim();
      }
    });
    this.answers = mapped;
  },

  // 15) Aplicar filtros e carregar respostas anteriores
  async aplicarFiltrosECarregarRespostas() {
    const perguntas = this.getAllFilteredQuestions();
    if (perguntas.length > 0) {
      await Qry_getAnswersSocial.run();
      this.loadPreviousAnswers();
    }
  },

  // 16) Filtro com Estado das Perguntas (fonte submetida/persistente)
  //     IMPORTANTE: este query já devolve apenas o ano mais recente (MAX(ano))
  answersSource() {
    const rows = Array.isArray(Qry_getAnswersSocial?.data)
      ? Qry_getAnswersSocial.data
      : [];
    return rows;
  },

  // Mapa de respostas submetidas/persistentes do utilizador (ano mais recente do query)
  getPersistedAnswersMap() {
    const map = {};
    const src = this.answersSource();
    src.forEach((r) => {
      const id = String(r?.id_pergunta);
      map[id] =
        r?.resposta == null || String(r?.resposta).trim() === ""
          ? ""
          : String(r.resposta).trim();
    });
    return map;
  },

  // Mapa de respostas final (submetidas/persistentes + sessão atual)
  getMergedAnswersMap() {
    const persisted = this.getPersistedAnswersMap();
    const live = this.answers || {};
    return {
      ...persisted,
      ...Object.fromEntries(
        Object.entries(live).map(([k, v]) => [String(k), v || ""])
      ),
    };
  },

  // Opções do filtro de estado da resposta
  statusOptions() {
    return [
      { label: "Selecionar todas", value: "all" },
      { label: "Respondidas", value: "answered" },
      { label: "Não respondidas", value: "unanswered" },
    ];
  },

  // 17) Filtro categorias (com widgets sociais)
  categoryOptions() {
    const all = this.getAllFilteredQuestions();
    const uniq = new Set();
    all.forEach((q) => {
      if (q?.categoria) uniq.add(String(q.categoria));
    });
    const cats = Array.from(uniq).sort((a, b) =>
      a.localeCompare(b, "pt", { sensitivity: "base" })
    );

    return [
      { label: "Selecionar todas", value: "__ALL__" },
      ...cats.map((c) => ({ label: c, value: c })),
    ];
  },

  // Devolve as categorias efetivas de acordo com o Multiselect_CategoriasSocial
  effectiveCategoryValues() {
    const selected = Multiselect_CategoriasSocial?.selectedOptionValues || [];
    const opts = this.categoryOptions()
      .filter((o) => o.value !== "__ALL__")
      .map((o) => o.value);

    if (selected.length === 0 || selected.includes("__ALL__")) return opts;
    return selected.filter((v) => opts.includes(v));
  },

  // 18) Visibilidade perguntas formulário (categoria + estado)
  applyUISubFilters(list) {
    const catVals = this.effectiveCategoryValues();

    const persistedMap = this.getPersistedAnswersMap();
    const mergedAnswers = this.getMergedAnswersMap();

    const status = Select_statusRespostasSocial?.selectedOptionValue || "all";

    return (list || [])
      .filter((q) => !q?.categoria || catVals.includes(String(q.categoria)))
      .filter((q) => {
        const id = String(q.id_pergunta);
        const merged = (mergedAnswers[id] || "").trim();
        const persisted = (persistedMap[id] || "").trim();

        if (status === "all") return true;
        if (status === "unanswered") return persisted === "";
        if (status === "answered") return merged !== "";
        return true;
      });
  },

  // Fonte final para o List widget
  listData() {
    const visible = this.getVisibleQuestions();
    return this.applyUISubFilters(visible);
  },

  // 19) Indicador de progresso x/y (z%)
  progressCounts() {
    const baseVisible = this.getVisibleQuestions();
    const mergedAnswers = this.getMergedAnswersMap();

    const y = Array.isArray(baseVisible) ? baseVisible.length : 0;
    let x = 0;

    (baseVisible || []).forEach((q) => {
      const id = String(q.id_pergunta);
      const ans = (mergedAnswers[id] || "").trim();
      if (ans !== "") x += 1;
    });

    const z = y > 0 ? Math.round((x / y) * 100) : 0;
    return { x, y, z };
  },

  progressText() {
    const { x, y, z } = this.progressCounts();
    return `${x}/${y} (${z}%)`;
  },

  perguntasRespondidasPct() {
    const { z } = this.progressCounts();
    const pct = Number(z) || 0;
    return Math.min(100, Math.max(0, pct));
  },

  // 20) Estado de persistência (BD)
  isFormPersistedCompletely() {
    const visible = this.getVisibleQuestions();
    if (!Array.isArray(visible) || visible.length === 0) return false;

    const src = this.answersSource();
    const persistedMap = {};
    src.forEach((r) => {
      const id = String(r?.id_pergunta);
      const val = r?.resposta == null ? "" : String(r.resposta).trim();
      persistedMap[id] = val;
    });

    return visible.every((q) => {
      const id = String(q.id_pergunta);
      const ans = (persistedMap[id] || "").trim();
      return ans !== "";
    });
  },

  // Estado local global
  isFormCompleteLocally() {
    const visible = this.getVisibleQuestions();
    const mergedAnswers = this.getMergedAnswersMap();
    if (!Array.isArray(visible) || visible.length === 0) return false;

    return visible.every((q) => {
      const id = String(q.id_pergunta);
      const ans = (mergedAnswers[id] || "").trim();
      return ans !== "";
    });
  },

  statusText() {
    const allAnsweredLocally = this.isFormCompleteLocally();
    const allAnsweredPersisted = this.isFormPersistedCompletely();

    if (allAnsweredLocally && allAnsweredPersisted) {
      return "Formulário completo.";
    }
    return "Respostas em falta. Responda a todas as perguntas e submeta o formulário, por favor.";
  },

  // Boolean agregado para estilos de texto
  isFormComplete() {
    return this.isFormCompleteLocally() && this.isFormPersistedCompletely();
  },
};