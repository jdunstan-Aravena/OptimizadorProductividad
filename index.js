const fileUpload = document.getElementById('fileUpload');
const message = document.getElementById('message');
const analysisResults = document.getElementById('analysisResults');
const charts = document.querySelector('.charts');
let chartInstances = {};
let messageTimeout;

// Configurar moment.js para usar el idioma español
moment.locale('es');

fileUpload.addEventListener('change', handleFileUpload);

function handleFileUpload(e) {
    const file = e.target.files[0];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        showMessage('Procesando archivo...', 'success');

        if (fileName.endsWith('.csv')) {
            Papa.parse(file, {
                complete: function (results) {
                    try {
                        processData(results.data);
                    } catch (error) {
                        handleError(error);
                    }
                },
                header: true,
                encoding: "UTF-8",
                error: function (error) {
                    handleError(error);
                }
            });
        } else {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    processData(jsonData);
                } catch (error) {
                    handleError(error);
                }
            };
            reader.onerror = function (error) {
                handleError(error);
            };
            reader.readAsArrayBuffer(file);
        }
    } else {
        showMessage('Error: Por favor, sube un archivo CSV o Excel.', 'error');
    }
}

function processData(data) {
    if (!data || data.length < 2) {
        throw new Error('El archivo está vacío o no contiene datos suficientes.');
    }

    const salesData = analyzeSalesData(data);
    if (salesData.length === 0) {
        throw new Error('No se pudieron procesar los datos de ventas.');
    }

    const insights = generateInsights(salesData);
    displayResults(insights);
    createCharts(salesData);
    showAnalysisResults();
}

function analyzeSalesData(data) {
    let headers;
    let dataRows;

    if (Array.isArray(data[0])) {
        headers = data[0];
        dataRows = data.slice(1);
    } else {
        headers = Object.keys(data[0]);
        dataRows = data;
    }

    const dateIndex = headers.findIndex(h => h.toLowerCase().includes('fecha'));
    const productIndex = headers.findIndex(h => h.toLowerCase().includes('producto'));
    const salesIndex = headers.findIndex(h => h.toLowerCase().includes('ventas'));

    if (dateIndex === -1 || productIndex === -1 || salesIndex === -1) {
        throw new Error('El archivo no contiene las columnas necesarias (fecha, producto, ventas).');
    }

    return dataRows.map(row => {
        let date, product, sales;

        if (Array.isArray(row)) {
            date = new Date(row[dateIndex]);
            product = row[productIndex];
            sales = parseFloat(row[salesIndex]);
        } else {
            date = new Date(row[headers[dateIndex]]);
            product = row[headers[productIndex]];
            sales = parseFloat(row[headers[salesIndex]]);
        }

        return { date, product, sales };
    }).filter(sale => !isNaN(sale.sales) && !isNaN(sale.date.getTime()));
}

function generateInsights(salesData) {
    const totalSales = salesData.reduce((sum, sale) => sum + sale.sales, 0);
    const averageSales = totalSales / salesData.length;
    const topProduct = salesData.reduce((max, sale) => max.sales > sale.sales ? max : sale);

    return {
        totalSales: totalSales.toFixed(2),
        averageSales: averageSales.toFixed(2),
        topProduct: topProduct.product,
        topProductSales: topProduct.sales.toFixed(2)
    };
}

function displayResults(insights) {
    analysisResults.innerHTML = `
                <h2>Resultados del Análisis</h2>
                <p><strong>Ventas totales:</strong> $${insights.totalSales}</p>
                <p><strong>Ventas promedio:</strong> $${insights.averageSales}</p>
                <p><strong>Producto más vendido:</strong> ${insights.topProduct} (Ventas: $${insights.topProductSales})</p>
                <h3>Recomendaciones:</h3>
                <ul>
                    <li>Considere aumentar el inventario de ${insights.topProduct}.</li>
                    <li>Analice los productos con ventas por debajo del promedio para posibles promociones.</li>
                    <li>Implemente estrategias de venta cruzada con ${insights.topProduct}.</li>
                </ul>
            `;
}

function createCharts(salesData) {
    createBarChart(salesData);
    createLineChart(salesData);
    createScatterChart(salesData);
}

function createBarChart(salesData) {
    const ctx = document.getElementById('salesBarChart').getContext('2d');

    const productSales = salesData.reduce((acc, sale) => {
        if (!acc[sale.product]) {
            acc[sale.product] = 0;
        }
        acc[sale.product] += sale.sales;
        return acc;
    }, {});

    if (chartInstances.barChart) {
        chartInstances.barChart.destroy();
    }

    chartInstances.barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(productSales),
            datasets: [{
                label: 'Ventas por Producto',
                data: Object.values(productSales),
                backgroundColor: 'rgba(52, 152, 219, 0.6)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Ventas por Producto',
                    font: {
                        size: 18
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Ventas ($)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Productos'
                    }
                }
            }
        }
    });
}

function createLineChart(salesData) {
    const ctx = document.getElementById('salesLineChart').getContext('2d');

    const dailySales = salesData.reduce((acc, sale) => {
        const dateStr = moment(sale.date).format('YYYY-MM-DD');
        if (!acc[dateStr]) {
            acc[dateStr] = 0;
        }
        acc[dateStr] += sale.sales;
        return acc;
    }, {});

    const sortedDates = Object.keys(dailySales).sort();

    if (chartInstances.lineChart) {
        chartInstances.lineChart.destroy();
    }

    chartInstances.lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Ventas Diarias',
                data: sortedDates.map(date => dailySales[date]),
                borderColor: 'rgba(231, 76, 60, 1)',
                backgroundColor: 'rgba(231, 76, 60, 0.2)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Ventas Diarias',
                    font: {
                        size: 18
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function (tooltipItems) {
                            return moment(tooltipItems[0].label).format('DD-MMM'); // Formato de la fecha sin hora
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Ventas ($)'
                    }
                },
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        parser: 'YYYY-MM-DD',
                        displayFormats: {
                            day: 'DD-MMM' // Formato de día y mes abreviado en español
                        }
                    },
                    title: {
                        display: true,
                        text: 'Fecha'
                    }
                }
            }
        }
    });
}

function createScatterChart(salesData) {
    const ctx = document.getElementById('salesScatterChart').getContext('2d');

    const scatterData = salesData.map(sale => ({
        x: moment(sale.date, 'YYYY-MM-DD').toDate(), // Convertir la fecha a objeto Date
        y: sale.sales
    }));

    if (chartInstances.scatterChart) {
        chartInstances.scatterChart.destroy();
    }

    chartInstances.scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Ventas vs Tiempo',
                data: scatterData,
                backgroundColor: 'rgba(44, 62, 80, 0.6)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribución de Ventas en el Tiempo',
                    font: {
                        size: 18
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function (tooltipItems) {
                            return moment(tooltipItems[0].raw.x).format('DD-MMM'); // Formato de la fecha sin hora en el tooltip
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'DD-MMM' // Formato de día y mes abreviado en español
                        }
                    },
                    title: {
                        display: true,
                        text: 'Fecha'
                    },
                    ticks: {
                        callback: function (value, index, values) {
                            return moment(value).format('DD-MMM'); // Formato de la fecha sin hora en el eje X
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Ventas ($)'
                    }
                }
            }
        }
    });
}


function handleError(error) {
    console.error('Error:', error);
    showMessage(`Error: ${error.message || 'Ha ocurrido un error al procesar el archivo.'}`, 'error');
    hideAnalysisResults();
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = type;
    message.style.display = 'block';

    // Clear any existing timeout
    if (messageTimeout) {
        clearTimeout(messageTimeout);
    }

    // Set a new timeout to hide the message after 10 seconds
    messageTimeout = setTimeout(() => {
        message.style.display = 'none';
    }, 10000);
}

function showAnalysisResults() {
    analysisResults.style.display = 'block';
    charts.style.display = 'flex';
}

function hideAnalysisResults() {
    analysisResults.style.display = 'none';
    charts.style.display = 'none';
    analysisResults.innerHTML = '';
    Object.values(chartInstances).forEach(chart => {
        if (chart) {
            chart.destroy();
        }
    });
    chartInstances = {};
}
