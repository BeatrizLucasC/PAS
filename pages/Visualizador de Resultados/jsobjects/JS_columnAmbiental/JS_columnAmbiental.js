export default {
  getChartConfig() {
    const dados = Qry_pontuacaoCategoria.data
      .filter(item => item.dominio === "Ambiental")
      .map(item => ({
        x: item.categoria,
        y: item.pontuacao_user
      }))
      .sort((a, b) => a.y - b.y);

    return {
      title: {
        text: "",
        left: "center",
        top: 8,
        textStyle: { fontSize: 20, fontWeight: "bold", color: "#444" }
      },
      grid: {
        left: 10,
        right: 20,
        top: 70,
        bottom: 80,
        containLabel: true
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" }
      },
      xAxis: {
        type: "category",
        data: dados.map(d => d.x),
        axisLabel: {
          interval: 0,       // mostra TODOS os labels
          rotate: 0,         // muda p/ 30 ou 45 se preferires rodar
          width: 110,
          overflow: "break", // quebra texto longo em várias linhas
          lineHeight: 14,
          fontSize: 11,
          color: "#666"
        },
        axisTick: { alignWithLabel: true }
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        splitLine: { lineStyle: { color: "#eee" } }
      },
      series: [
        {
          type: "bar",
          data: dados.map(d => d.y),
          barWidth: "60%",
          itemStyle: { color: "#8ac040" },
          label: {
            show: true,
            position: "top",
            color: "#444",
            fontSize: 12,
            formatter: (p) =>
              Number.isInteger(p.value) ? p.value : p.value.toFixed(2)
          }
        }
      ]
    };
  }
}