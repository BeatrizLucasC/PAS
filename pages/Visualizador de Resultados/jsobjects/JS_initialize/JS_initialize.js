export default {
  async initializePage() {
		//Login_user
		const autenticacao = {"username":"Beatriz Cardoso","nif":123456789,"email":"bcardoso@consulai.com"};
		await storeValue("autenticacao",autenticacao,true);

      // 1) Executa primeiro: Qry_years
      await Qry_years.run();

      // 2) Em segundo: Qry_visibilityIcon
      await Qry_visibilityIcon.run();

      // 3) Depois, executa os restantes queries.
      // Não há dependências. Execução em paralelo (mais rápido):
      await Promise.all([
        Qry_visibilityPage.run(),
        Qry_visibilityTab.run(),
				Qry_pontuacaoGlobal.run(),
        Qry_pontuacaoDominio.run(),
        Qry_pontuacaoCategoria.run(),
        Qry_pontuacaoIndicador.run(),
        Qry_pctAdaptacao.run(),
        Qry_pctMitigacao.run()
      ]);

      showAlert("Página inicializada com sucesso.", "success");
    } 
};
