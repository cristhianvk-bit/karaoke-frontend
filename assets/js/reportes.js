const userDataStorage = JSON.parse(localStorage.getItem('usuario') || '{}');
const userRoleStorage = userDataStorage.role?.name || '';
const isAdminStorage = userRoleStorage === 'Administrador';

if (isAdminStorage) {
    document.body.classList.add('es-admin');
    console.log('es-admin agregado desde localStorage');
}

const API_URL = 'http://localhost:8000/api';
const token = localStorage.getItem('token');
let USER_DATA = {};
let datosReporteActual = [];
let tipoReporteActual = 'ventas';

try {
    USER_DATA = JSON.parse(localStorage.getItem('usuario') || '{}');
} catch (e) {
    console.error('Error al parsear usuario:', e);
}

if (!token) {
    window.location.href = "index.html";
}

/* API CALL */
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method: method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    if (body) options.body = JSON.stringify(body);

    const respuesta = await fetch(`${API_URL}${endpoint}`, options);

    if (respuesta.status === 401) {
        localStorage.clear();
        window.location.href = "index.html";
        return;
    }

    if (!respuesta.ok) {
        const errorData = await respuesta.json().catch(() => ({}));
        throw { status: respuesta.status, data: errorData };
    }

    return respuesta.json();
}

document.addEventListener('DOMContentLoaded', async () => {
    await configurarRol();
    configurarFiltros();
    configurarBotones();
    configurarModal();
    await cargarEstadisticasGenerales();
    
    // Establecer fechas por defecto hoy
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaInicio').value = hoy;
    document.getElementById('fechaFin').value = hoy;
});

/* CONFIGURAR ROL */
async function configurarRol() {
    try {
        const user = await apiCall('/me');
        const USER_ROLE = user.role?.name || "Empleado";
        const IS_ADMIN = USER_ROLE === "Administrador";
 
        const badgeRol = document.getElementById("badgeRol");
        const nombreUsuario = document.getElementById("nombreUsuario");
 
        if (nombreUsuario) {
            nombreUsuario.textContent = `${user.first_name} ${user.last_name || ''}`;
        }
 
        if (IS_ADMIN) {
            document.body.classList.add('es-admin');
        } else {
            document.body.classList.remove('es-admin');
            if (badgeRol) {
                badgeRol.textContent = "Empleado";
                badgeRol.classList.add("badge-empleado");
            }
        }
 
    } catch (error) {
        console.error('Error al configurar rol:', error);
    }
}
/* CARGAR ESTADISTICAS  */
async function cargarEstadisticasGenerales() {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const ultimoDiaMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

        // cargar datos en paralelo
        const [ventasDia, resumenMes, ordenesPagadas, topProductos, stockBajo] = await Promise.all([
            apiCall(`/reports/daily-sales?date=${hoy}`).catch(() => []),
            apiCall(`/reports/payment-summary?start=${primerDiaMes}&end=${ultimoDiaMes}`).catch(() => []),
            apiCall(`/reports/orders-by-status?status=Pagado`).catch(() => []),
            apiCall(`/reports/top-products?count=1000`).catch(() => []),
            apiCall('/reports/low-stock').catch(() => [])
        ]);

        // ventas del dia
        const totalVentasDia = ventasDia.reduce((sum, item) => sum + parseFloat(item.total_vendido || 0), 0);
        document.getElementById('statVentasDia').textContent = `Bs ${totalVentasDia.toFixed(2)}`;

        // ventas del mes
        const totalVentasMes = resumenMes.reduce((sum, item) => sum + parseFloat(item.monto_total || 0), 0);
        document.getElementById('statVentasMes').textContent = `Bs ${totalVentasMes.toFixed(2)}`;

        // ordenes cerradas
        document.getElementById('statOrdenesCerradas').textContent = ordenesPagadas.length;

        // productos vendidos
        const totalProductos = topProductos.reduce((sum, item) => sum + parseInt(item.total_unidades || 0), 0);
        document.getElementById('statProductosVendidos').textContent = totalProductos;

        // panel inferior
        document.getElementById('resumenTotalVentas').textContent = `Bs ${totalVentasMes.toFixed(2)}`;
        document.getElementById('resumenProductosVendidos').textContent = totalProductos;
        document.getElementById('resumenOrdenes').textContent = ordenesPagadas.length;
        document.getElementById('resumenStockBajo').textContent = stockBajo.length;

    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

/* CONFIGURAR FILTROS */
function configurarFiltros() {
    document.getElementById('tipoReporte').addEventListener('change', () => {
        // autro generar 
    });
}

/* CONFIGURAR BOTONES */
function configurarBotones() {
    document.getElementById('btnGenerar').addEventListener('click', generarReporte);
    document.getElementById('btnExportarPDF').addEventListener('click', exportarPDF);
    document.getElementById('btnExportarExcel').addEventListener('click', exportarExcel);
    document.getElementById('btnImprimir').addEventListener('click', () => window.print());

    // Logout
    const logoutBtn = document.querySelector('.link-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await apiCall('/logout', 'POST');
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            } finally {
                localStorage.clear();
                window.location.href = 'index.html';
            }
        });
    }
}

/* GENERAR REPORTE */
async function generarReporte() {
    const tipo = document.getElementById('tipoReporte').value;
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;

    tipoReporteActual = tipo;
    datosReporteActual = [];

    const tbody = document.getElementById('tbodyReportes');

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-reporte">
                <i class="fa-solid fa-spinner"></i>
                Generando reporte...
            </td>
        </tr>
    `;

    try {
        let data = [];

        switch (tipo) {
            case 'ventas':
                const fechaConsulta = fechaFin || new Date().toISOString().split('T')[0];
                data = await apiCall(`/reports/daily-sales?date=${fechaConsulta}`);
                renderizarReporteVentas(data, null, fechaConsulta);
                break;

            case 'productos':
                data = await apiCall('/reports/top-products?count=100');
                renderizarReporteProductos(data, null);
                break;

            case 'espacios':
                data = await apiCall('/reports/orders-by-status?status=Pagado');
                renderizarReporteEspacios(data, null);
                break;

            case 'pagos':
                const start = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                const end = fechaFin || new Date().toISOString().split('T')[0];
                data = await apiCall(`/reports/payment-summary?start=${start}&end=${end}`);
                renderizarReportePagos(data, null, start, end);
                break;

            case 'stock-bajo':
                data = await apiCall('/reports/low-stock');
                renderizarReporteStockBajo(data, null);
                break;
        }

        datosReporteActual = data;

    } catch (error) {
        console.error('Error al generar reporte:', error);
        const mensajeError = error.data?.message || error.message || 'Error desconocido';
        
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:30px; color:#dc2626;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size:40px; display:block; margin-bottom:15px;"></i>
                    <strong>Error al generar el reporte</strong>
                    <p style="margin-top:10px; font-size:14px;">${mensajeError}</p>
                    <button onclick="generarReporte()" style="margin-top:15px; padding:8px 16px; background:#7c3aed; color:white; border:none; border-radius:6px; cursor:pointer;">
                        <i class="fa-solid fa-rotate-right"></i> Reintentar
                    </button>
                </td>
            </tr>
        `;
    }
}

/* VENTAS */
function renderizarReporteVentas(data, columnas, fecha) {
    const thead = document.getElementById('theadReportes');
    const tbody = document.getElementById('tbodyReportes');

    thead.innerHTML = `
        <tr>
            <th>#</th>
            <th>Producto</th>
            <th>Cantidad Vendida</th>
            <th>Total Vendido</th>
            <th>Acciones</th>
        </tr>
    `;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:30px; color:#9ca3af;">
                    No hay ventas registradas para la fecha seleccionada
                </td>
            </tr>
        `;
        return;
    }

    const totalGeneral = data.reduce((sum, item) => sum + parseFloat(item.total_vendido || 0), 0);
    const totalUnidades = data.reduce((sum, item) => sum + parseInt(item.cantidad_vendida || 0), 0);

    tbody.innerHTML = data.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${item.producto}</strong></td>
            <td>${item.cantidad_vendida}</td>
            <td><strong>Bs ${parseFloat(item.total_vendido).toFixed(2)}</strong></td>
            <td class="acciones">
                <button class="btn-ver-reporte" onclick='verDetalleVenta(${JSON.stringify(item)}, "${fecha}")'>
                    <i class="fa-solid fa-eye"></i> Ver
                </button>
            </td>
        </tr>
    `).join('') + `
        <tr style="background:#f9fafb; font-weight:bold;">
            <td colspan="2" style="text-align:right; padding-right:20px;">TOTALES:</td>
            <td>${totalUnidades}</td>
            <td>Bs ${totalGeneral.toFixed(2)}</td>
            <td></td>
        </tr>
    `;
}

/* PRODUCTOS */
function renderizarReporteProductos(data, columnas) {
    const thead = document.getElementById('theadReportes');
    const tbody = document.getElementById('tbodyReportes');

    thead.innerHTML = `
        <tr>
            <th>#</th>
            <th>Producto</th>
            <th>Unidades Vendidas</th>
            <th>Acciones</th>
        </tr>
    `;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; padding:30px; color:#9ca3af;">
                    No hay productos vendidos aún
                </td>
            </tr>
        `;
        return;
    }

    const totalUnidades = data.reduce((sum, item) => sum + parseInt(item.total_unidades || 0), 0);

    tbody.innerHTML = data.map((item, index) => {
        const medalla = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
        return `
            <tr>
                <td style="font-size:18px;">${medalla}</td>
                <td><strong>${item.name}</strong></td>
                <td><strong>${item.total_unidades}</strong> unidades</td>
                <td class="acciones">
                    <button class="btn-ver-reporte" onclick='verDetalleProducto(${JSON.stringify(item)}, ${index + 1})'>
                        <i class="fa-solid fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('') + `
        <tr style="background:#f9fafb; font-weight:bold;">
            <td colspan="2" style="text-align:right; padding-right:20px;">TOTAL UNIDADES:</td>
            <td>${totalUnidades}</td>
            <td></td>
        </tr>
    `;
}

/* ESPACIOS */
function renderizarReporteEspacios(data, columnas) {
    const thead = document.getElementById('theadReportes');
    const tbody = document.getElementById('tbodyReportes');

    thead.innerHTML = `
        <tr>
            <th>Folio</th>
            <th>Espacio</th>
            <th>Total</th>
            <th>Pagado</th>
            <th>Fecha Apertura</th>
            <th>Acciones</th>
        </tr>
    `;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:30px; color:#9ca3af;">
                    No hay órdenes cerradas
                </td>
            </tr>
        `;
        return;
    }

    const totalGeneral = data.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0);

    tbody.innerHTML = data.map(item => {
        const fecha = new Date(item.opened_at).toLocaleString('es-BO');
        return `
            <tr>
                <td><strong>${item.folio}</strong></td>
                <td>${item.espacio}</td>
                <td>Bs ${parseFloat(item.total_amount).toFixed(2)}</td>
                <td>Bs ${parseFloat(item.paid_amount).toFixed(2)}</td>
                <td>${fecha}</td>
                <td class="acciones">
                    <button class="btn-ver-reporte" onclick='verDetalleOrden(${JSON.stringify(item)})'>
                        <i class="fa-solid fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('') + `
        <tr style="background:#f9fafb; font-weight:bold;">
            <td colspan="2" style="text-align:right; padding-right:20px;">TOTALES:</td>
            <td>Bs ${totalGeneral.toFixed(2)}</td>
            <td colspan="3"></td>
        </tr>
    `;
}

/* PAGOS */
function renderizarReportePagos(data, columnas, start, end) {
    const thead = document.getElementById('theadReportes');
    const tbody = document.getElementById('tbodyReportes');

    thead.innerHTML = `
        <tr>
            <th>Método de Pago</th>
            <th>N° Operaciones</th>
            <th>Monto Total</th>
            <th>Acciones</th>
        </tr>
    `;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; padding:30px; color:#9ca3af;">
                    No hay pagos registrados en el período seleccionado
                </td>
            </tr>
        `;
        return;
    }

    const totalOperaciones = data.reduce((sum, item) => sum + parseInt(item.operaciones || 0), 0);
    const totalMonto = data.reduce((sum, item) => sum + parseFloat(item.monto_total || 0), 0);

    tbody.innerHTML = data.map(item => {
        let icono = 'fa-receipt';
        let clase = 'efectivo';
        const metodo = item.metodo?.toLowerCase() || '';
        
        if (metodo.includes('qr')) { icono = 'fa-qrcode'; clase = 'qr'; }
        else if (metodo.includes('tarjeta')) { icono = 'fa-credit-card'; clase = 'tarjeta'; }
        else if (metodo.includes('efectivo')) { icono = 'fa-money-bill-wave'; clase = 'efectivo'; }

        return `
            <tr>
                <td>
                    <span class="badge-metodo ${clase}" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:600;">
                        <i class="fa-solid ${icono}"></i>
                        ${item.metodo}
                    </span>
                </td>
                <td>${item.operaciones}</td>
                <td><strong>Bs ${parseFloat(item.monto_total).toFixed(2)}</strong></td>
                <td class="acciones">
                    <button class="btn-ver-reporte" onclick='verDetallePago(${JSON.stringify(item)}, "${start}", "${end}")'>
                        <i class="fa-solid fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('') + `
        <tr style="background:#f9fafb; font-weight:bold;">
            <td style="text-align:right; padding-right:20px;">TOTALES:</td>
            <td>${totalOperaciones}</td>
            <td>Bs ${totalMonto.toFixed(2)}</td>
            <td></td>
        </tr>
    `;
}

/* STOCK BAJO */
function renderizarReporteStockBajo(data, columnas) {
    const thead = document.getElementById('theadReportes');
    const tbody = document.getElementById('tbodyReportes');

    thead.innerHTML = `
        <tr>
            <th>#</th>
            <th>Producto</th>
            <th>Stock Actual</th>
            <th>Stock Mínimo</th>
            <th>Diferencia</th>
            <th>Acciones</th>
        </tr>
    `;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:30px; color:#059669;">
                    <i class="fa-solid fa-circle-check" style="font-size:30px; display:block; margin-bottom:10px;"></i>
                    ¡Excelente! No hay productos con stock bajo
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map((item, index) => {
        const diferencia = item.current_stock - item.minimum_stock;
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${item.name}</strong></td>
                <td style="color:#dc2626; font-weight:700;">${item.current_stock}</td>
                <td>${item.minimum_stock}</td>
                <td style="color:#dc2626; font-weight:700;">${diferencia}</td>
                <td class="acciones">
                    <button class="btn-ver-reporte" onclick='verDetalleStock(${JSON.stringify(item)})'>
                        <i class="fa-solid fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/* DETALLE */
function configurarModal() {
    document.getElementById('modalDetalle').addEventListener('click', (e) => {
        if (e.target.id === 'modalDetalle') cerrarModalDetalle();
    });
}

function abrirModalDetalle(contenidoHTML) {
    document.getElementById('detalleContenido').innerHTML = contenidoHTML;
    document.getElementById('modalDetalle').style.display = 'flex';
}

function cerrarModalDetalle() {
    document.getElementById('modalDetalle').style.display = 'none';
}

function verDetalleVenta(item, fecha) {
    abrirModalDetalle(`
        <div class="detalle-grid-reporte">
            <div class="detalle-item-reporte" style="grid-column: 1/-1;">
                <label>Producto</label>
                <span style="font-size:20px;">${item.producto}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Fecha del Reporte</label>
                <span>${new Date(fecha).toLocaleDateString('es-BO')}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Cantidad Vendida</label>
                <span>${item.cantidad_vendida} unidades</span>
            </div>
            <div class="detalle-item-reporte destacado">
                <label>Total Vendido</label>
                <span>Bs ${parseFloat(item.total_vendido).toFixed(2)}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Precio Promedio</label>
                <span>Bs ${(parseFloat(item.total_vendido) / parseInt(item.cantidad_vendida)).toFixed(2)}</span>
            </div>
        </div>
    `);
}

function verDetalleProducto(item, posicion) {
    const medalla = posicion === 1 ? '🥇 1er Lugar' : posicion === 2 ? '🥈 2do Lugar' : posicion === 3 ? '🥉 3er Lugar' : `${posicion}° Lugar`;
    abrirModalDetalle(`
        <div class="detalle-grid-reporte">
            <div class="detalle-item-reporte" style="grid-column: 1/-1;">
                <label>Producto</label>
                <span style="font-size:20px;">${item.name}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Posición en Ranking</label>
                <span>${medalla}</span>
            </div>
            <div class="detalle-item-reporte destacado">
                <label>Total Unidades Vendidas</label>
                <span>${item.total_unidades}</span>
            </div>
        </div>
    `);
}

function verDetalleOrden(item) {
    abrirModalDetalle(`
        <div class="detalle-grid-reporte">
            <div class="detalle-item-reporte" style="grid-column: 1/-1;">
                <label>Folio</label>
                <span style="font-size:20px;">${item.folio}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Espacio</label>
                <span>${item.espacio}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Fecha de Apertura</label>
                <span>${new Date(item.opened_at).toLocaleString('es-BO')}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Total</label>
                <span>Bs ${parseFloat(item.total_amount).toFixed(2)}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Pagado</label>
                <span>Bs ${parseFloat(item.paid_amount).toFixed(2)}</span>
            </div>
            <div class="detalle-item-reporte destacado">
                <label>Saldo</label>
                <span>Bs ${(parseFloat(item.total_amount) - parseFloat(item.paid_amount)).toFixed(2)}</span>
            </div>
        </div>
    `);
}

function verDetallePago(item, start, end) {
    abrirModalDetalle(`
        <div class="detalle-grid-reporte">
            <div class="detalle-item-reporte" style="grid-column: 1/-1;">
                <label>Método de Pago</label>
                <span style="font-size:20px;">${item.metodo}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Período Inicio</label>
                <span>${new Date(start).toLocaleDateString('es-BO')}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Período Fin</label>
                <span>${new Date(end).toLocaleDateString('es-BO')}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>N° de Operaciones</label>
                <span>${item.operaciones}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Promedio por Operación</label>
                <span>Bs ${(parseFloat(item.monto_total) / parseInt(item.operaciones)).toFixed(2)}</span>
            </div>
            <div class="detalle-item-reporte destacado">
                <label>Monto Total Recaudado</label>
                <span>Bs ${parseFloat(item.monto_total).toFixed(2)}</span>
            </div>
        </div>
    `);
}

function verDetalleStock(item) {
    const porcentaje = ((item.current_stock / item.minimum_stock) * 100).toFixed(0);
    abrirModalDetalle(`
        <div class="detalle-grid-reporte">
            <div class="detalle-item-reporte" style="grid-column: 1/-1;">
                <label>Producto</label>
                <span style="font-size:20px;">${item.name}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Stock Actual</label>
                <span style="color:#dc2626; font-size:24px;">${item.current_stock}</span>
            </div>
            <div class="detalle-item-reporte">
                <label>Stock Mínimo</label>
                <span>${item.minimum_stock}</span>
            </div>
            <div class="detalle-item-reporte destacado">
                <label>Nivel de Stock</label>
                <span>${porcentaje}% del mínimo requerido</span>
            </div>
            <div class="detalle-item-reporte" style="grid-column: 1/-1; border-left-color:#dc2626; background:#fee2e2;">
                <label>⚠️ Recomendación</label>
                <span style="color:#991b1b;">Se recomienda reponer stock urgentemente</span>
            </div>
        </div>
    `);
}

/* EXPORTAR A EXCEL */
function exportarExcel() {
    if (!datosReporteActual || datosReporteActual.length === 0) {
        alert('Primero genera un reporte para exportar');
        return;
    }

    const tabla = document.getElementById('tablaReportes');
    let csv = [];
    
    // Obtener filas de la tabla 
    const rows = tabla.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = [];
        cols.forEach(col => {
            // Limpiar texto y escapar comillas
            let text = col.innerText.replace(/"/g, '""');
            rowData.push(`"${text}"`);
        });
        csv.push(rowData.join(','));
    });

    const csvString = csv.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_${tipoReporteActual}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* EXPORTAR A PDF */
function exportarPDF() {
    if (!datosReporteActual || datosReporteActual.length === 0) {
        alert('Primero genera un reporte para exportar');
        return;
    }
    
    // Usar la funcion de impresion del navegador 
    alert('Se abrirá el diálogo de impresión. Selecciona "Guardar como PDF" como destino.');
    setTimeout(() => window.print(), 500);
}