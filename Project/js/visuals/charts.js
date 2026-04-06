(() => {
  const chartRegistry = new Set();

  function applyGlobalChartDefaults() {
    if (!window.Chart) return;
    const theme = getThemeColors();
    Chart.defaults.color = theme.legend;
    Chart.defaults.borderColor = theme.gridSoft;
  }

  function formatCurrency(value, compact = false) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0
    }).format(value || 0);
  }

  function getPalette(name = 'minimal') {
    if (name === 'brand') {
      return {
        income: '#2f6fed',
        expense: '#f7834f',
        incomeFillTop: 'rgba(47, 111, 237, 0.16)',
        incomeFillBottom: 'rgba(47, 111, 237, 0.02)',
        expenseFillTop: 'rgba(247, 131, 79, 0.14)',
        expenseFillBottom: 'rgba(247, 131, 79, 0.02)',
        donut: ['#2f6fed', '#f7834f', '#2fbf71', '#7c62ff', '#f5a524', '#0ea5a4', '#475569']
      };
    }

    return {
      income: '#2f6fed',
      expense: '#94a3b8',
      incomeFillTop: 'rgba(47, 111, 237, 0.10)',
      incomeFillBottom: 'rgba(47, 111, 237, 0.01)',
      expenseFillTop: 'rgba(148, 163, 184, 0.10)',
      expenseFillBottom: 'rgba(148, 163, 184, 0.01)',
      donut: ['#2f6fed', '#f7834f', '#0f172a', '#475569', '#94a3b8', '#cbd5e1', '#eef2ff']
    };
  }

  function getThemeColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
      legend: isDark ? '#edf2ff' : '#475569',
      ticks: isDark ? '#c2ccda' : '#64748b',
      centerPrimary: isDark ? '#ffffff' : '#1e293b',
      centerSecondary: isDark ? '#d2d8e2' : '#64748b',
      donutBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff',
      grid: isDark ? 'rgba(194, 204, 218, 0.18)' : 'rgba(148, 163, 184, 0.12)',
      gridSoft: isDark ? 'rgba(194, 204, 218, 0.12)' : 'rgba(148, 163, 184, 0.10)'
    };
  }

  function registerChart(chart) {
    chartRegistry.add(chart);
    const originalDestroy = chart.destroy.bind(chart);
    chart.destroy = () => {
      chartRegistry.delete(chart);
      return originalDestroy();
    };
    return chart;
  }

  function applyThemeToChart(chart) {
    if (!chart) return;
    const theme = getThemeColors();
    const options = chart.options || {};

    if (options.plugins?.legend?.labels) {
      options.plugins.legend.labels.color = theme.legend;
    }

    if (options.scales?.x?.ticks) {
      options.scales.x.ticks.color = theme.ticks;
    }
    if (options.scales?.y?.ticks) {
      options.scales.y.ticks.color = theme.ticks;
    }
    if (options.scales?.x?.grid) {
      options.scales.x.grid.color = theme.gridSoft;
    }
    if (options.scales?.y?.grid) {
      options.scales.y.grid.color = theme.grid;
    }

    const dataset = chart.data?.datasets?.[0];
    if (dataset && chart.config.type === 'doughnut') {
      dataset.borderColor = theme.donutBorder;
    }

    chart.update();
  }

  function createCashflowLineChart(canvas, options = {}) {
    const {
      labels = [],
      incomeData = [],
      expenseData = [],
      palette = 'minimal',
      legendPosition = 'top',
      showLegend = true
    } = options;

    const colors = getPalette(palette);
    const theme = getThemeColors();
    const ctx = canvas.getContext('2d');

    const incomeGradient = ctx.createLinearGradient(0, 0, 0, 320);
    incomeGradient.addColorStop(0, colors.incomeFillTop);
    incomeGradient.addColorStop(1, colors.incomeFillBottom);

    const expenseGradient = ctx.createLinearGradient(0, 0, 0, 320);
    expenseGradient.addColorStop(0, colors.expenseFillTop);
    expenseGradient.addColorStop(1, colors.expenseFillBottom);

    return registerChart(new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            borderColor: colors.income,
            backgroundColor: incomeGradient,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: colors.income,
            pointBorderWidth: 1.5,
            fill: true,
            tension: 0.25
          },
          {
            label: 'Expenses',
            data: expenseData,
            borderColor: colors.expense,
            backgroundColor: expenseGradient,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: colors.expense,
            pointBorderWidth: 1.5,
            fill: true,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: showLegend,
            position: legendPosition,
            align: 'start',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 7,
              boxHeight: 7,
              padding: 14,
              color: theme.legend
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            padding: 12,
            displayColors: true,
            callbacks: {
              label(context) {
                const value = context.parsed.y || 0;
                return `${context.dataset.label}: ${formatCurrency(value)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: theme.gridSoft,
              drawBorder: false
            },
            ticks: {
              color: theme.ticks,
              font: { size: 12 }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: theme.grid,
              borderDash: [4, 4],
              drawBorder: false
            },
            ticks: {
              color: theme.ticks,
              callback(value) {
                return formatCurrency(value, true);
              }
            }
          }
        }
      }
    }));
  }

  function createSpendingDonutChart(canvas, options = {}) {
    const {
      labels = [],
      data = [],
      total = 0,
      palette = 'minimal',
      legendPosition = 'bottom',
      legendAlign = 'center',
      centerLabel = 'Total spend',
      centerCompact = true,
      showLegend = true
    } = options;

    const colors = getPalette(palette);
    const donutCenterText = {
      id: 'donutCenterText',
      beforeDraw(chart) {
        const theme = getThemeColors();
        const meta = chart.getDatasetMeta(0).data[0];
        if (!meta) return;

        const centerX = meta.x;
        const centerY = meta.y;
        const ctx = chart.ctx;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = theme.centerPrimary;
        ctx.font = '700 18px Inter, sans-serif';
        if (document.documentElement.classList.contains('dark')) {
          ctx.shadowColor = 'rgba(15, 23, 42, 0.5)';
          ctx.shadowBlur = 10;
        }
        ctx.fillText(formatCurrency(total, centerCompact), centerX, centerY - 8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = theme.centerSecondary;
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillText(centerLabel, centerX, centerY + 12);
        ctx.restore();
      }
    };

    return registerChart(new Chart(canvas, {
      type: 'doughnut',
      plugins: [donutCenterText],
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.donut.slice(0, data.length),
          borderColor: getThemeColors().donutBorder,
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            display: showLegend,
            position: legendPosition,
            align: legendAlign,
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 7,
              boxHeight: 7,
              padding: 12,
              color: getThemeColors().legend
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            padding: 12,
            callbacks: {
              label(context) {
                const value = context.raw || 0;
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return `${context.label}: ${formatCurrency(value)} (${pct}%)`;
              }
            }
          }
        }
      }
    }));
  }

  window.addEventListener('finly:themechange', () => {
    applyGlobalChartDefaults();
    chartRegistry.forEach((chart) => applyThemeToChart(chart));
  });

  applyGlobalChartDefaults();

  window.FinanceCharts = {
    formatCurrency,
    createCashflowLineChart,
    createSpendingDonutChart,
    applyThemeToChart
  };
})();
