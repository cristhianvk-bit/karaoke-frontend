const API_BASE_URL = 'http://localhost:8000/api';
let TOKEN = localStorage.getItem('token');
let USER_DATA = {};

try {
    USER_DATA = JSON.parse(localStorage.getItem('usuario') || '{}');
} catch (e) {
    console.error('error al parsear usuario:', e);
}

let ordenesCache = [];
let espaciosCache = [];
let tiposEspacioCache = [];
let productosCache = [];
let rentasCache = [];
let ordenActual = null;

if (!TOKEN) {
    window.location.href = 'index.html';
} else {
    document.addEventListener('DOMContentLoaded', iniciarPagina);
}

// funcion para formatear fecha con am/pm
function formatearFechaConAMPM(fechaStr) {
    if (!fechaStr) return '-';
    
    const fecha = new Date(fechaStr);
    if (isNaN(fecha)) return fechaStr;
    
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    
    let horas = fecha.getHours();
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    const ampm = horas >= 12 ? 'p. m.' : 'a. m.';
    
    horas = horas % 12;
    horas = horas ? horas : 12;
    
    return `${dia}/${mes}/${anio} ${horas}:${minutos} ${ampm}`;
}

// funcion para formatear solo hora con am/pm
function formatearHoraConAMPM(fechaStr) {
    if (!fechaStr) return '-';
    
    const fecha = new Date(fechaStr);
    if (isNaN(fecha)) return fechaStr;
    
    let horas = fecha.getHours();
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    const ampm = horas >= 12 ? 'p. m.' : 'a. m.';
    
    horas = horas % 12;
    horas = horas ? horas : 12;
    
    return `${horas}:${minutos} ${ampm}`;
}

async function iniciarPagina() {
    try {
        document.getElementById('nombreUsuario').textContent = `${USER_DATA.first_name} ${USER_DATA.last_name || ''}`;
        document.getElementById('badgeRol').textContent = USER_DATA.role?.name || 'Empleado';

        controlarRoles();
        
        await cargarDatosBase();
        await cargarOrdenes();
        await cargarRentas();
        await cargarEstadisticas();
        
        configurarFiltros();
        configurarBotones();
        configurarLogout();
        configurarFormularios();
        
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) cerrarModal(modal.id);
            });
        });
        
    } catch (error) {
        console.error('error al iniciar pagina:', error);
    }
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
    };
}

function controlarRoles() {
    const esAdmin = USER_DATA.role?.name === 'Administrador';
    if (esAdmin) {
        document.body.classList.add('es-admin');
    } else {
        document.body.classList.remove('es-admin');
    }
}

async function cargarDatosBase() {
    try {
        const [espRes, tiposRes, prodRes] = await Promise.all([
            fetch(`${API_BASE_URL}/spaces`, { headers: getHeaders() }),
            fetch(`${API_BASE_URL}/space-types`, { headers: getHeaders() }),
            fetch(`${API_BASE_URL}/products`, { headers: getHeaders() })
        ]);
        
        espaciosCache = await espRes.json();
        tiposEspacioCache = await tiposRes.json();
        productosCache = await prodRes.json();
    } catch (error) {
        console.error('error al cargar datos base:', error);
    }
}

async function cargarOrdenes() {
    try {
        const response = await fetch(`${API_BASE_URL}/orders`, { headers: getHeaders() });
        if (!response.ok) throw new Error('error al cargar ordenes');
        
        ordenesCache = await response.json();
        const ordenesActivas = ordenesCache.filter(o => 
            o.order_status_id === 1 || o.order_status_id === 3
        );
        
        const tbody = document.getElementById('cuerpoTablaOrdenes');
        tbody.innerHTML = '';
        
        if (ordenesActivas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="sin-datos">no hay ordenes activas</td></tr>';
            return;
        }
        
        ordenesActivas.forEach(orden => {
            const espacio = espaciosCache.find(e => e.id === orden.space_id);
            const tipoEspacio = espacio ? tiposEspacioCache.find(t => t.id === espacio.space_type_id) : null;
            tbody.appendChild(crearFilaOrden(orden, espacio, tipoEspacio));
        });
        
    } catch (error) {
        console.error('error al cargar ordenes:', error);
    }
}

async function cargarRentas() {
    try {
        const ordenesActivas = ordenesCache.filter(o => 
            o.order_status_id === 1 || o.order_status_id === 3
        );
        
        rentasCache = [];
        
        for (const orden of ordenesActivas) {
            try {
                const response = await fetch(`${API_BASE_URL}/orders/${orden.id}/rentals`, { 
                    headers: getHeaders() 
                });
                if (response.ok) {
                    const rentas = await response.json();
                    rentasCache.push(...rentas);
                } else if (response.status === 403) {
                    console.warn(`403 en orden ${orden.id}, saltando`);
                }
            } catch (error) {
                console.warn(`error al cargar rentas de orden ${orden.id}:`, error);
            }
        }
        
        console.log('rentas cargadas:', rentasCache.length);
    } catch (error) {
        console.error('error al cargar rentas:', error);
    }
}

function crearFilaOrden(orden, espacio, tipoEspacio) {
    const tr = document.createElement('tr');
    
    let icono = '';
    if (tipoEspacio?.name === 'Cuarto') {
        icono = '<i class="fa-solid fa-door-open" style="color:#7c3aed;margin-right:6px"></i>';
    } else if (tipoEspacio?.name === 'Mesa') {
        icono = '<i class="fa-solid fa-table" style="color:#059669;margin-right:6px"></i>';
    } else if (tipoEspacio?.name === 'Barra') {
        icono = '<i class="fa-solid fa-martini-glass" style="color:#d97706;margin-right:6px"></i>';
    }
    
    let claseEstado = '', nombreEstado = '';
    if (orden.order_status_id === 1) {
        claseEstado = 'estado-pendiente';
        nombreEstado = 'Pendiente';
    } else if (orden.order_status_id === 3) {
        claseEstado = 'estado-parcial';
        nombreEstado = 'Parcial';
    } else if (orden.order_status_id === 2) {
        claseEstado = 'estado-pagado';
        nombreEstado = 'Pagado';
    } else if (orden.order_status_id === 4) { 
        claseEstado = 'estado-anulado';
        nombreEstado = 'Anulado';
    }
    
    const horaApertura = formatearHoraConAMPM(orden.opened_at);
    
    const esAdmin = USER_DATA.role?.name === 'Administrador';
    const esPendiente = orden.order_status_id === 1;
    const esParcial = orden.order_status_id === 3;
    const esCuarto = tipoEspacio?.name === 'Cuarto';
    
    const rentaActiva = rentasCache.find(r => r.order_id === orden.id && r.is_active);
    
    let botonesRenta = '';
    if (esCuarto && (esPendiente || esParcial)) {
        if (rentaActiva) {
            botonesRenta = `
                <button class="btn-accion btn-detener" onclick="detenerRenta(${rentaActiva.id})" title="detener renta">
                    <i class="fa-solid fa-stop"></i>
                </button>
            `;
        } else {
            botonesRenta = `
                <button class="btn-accion btn-iniciar" onclick="iniciarRenta(${orden.id})" title="iniciar renta">
                    <i class="fa-solid fa-play"></i>
                </button>
            `;
        }
    }
    
    const puedeAnular = esAdmin && !rentaActiva && (esPendiente || esParcial);
    
    tr.innerHTML = `
        <td><strong>${orden.folio}</strong></td>
        <td>${icono}${espacio?.name || 'N/A'}</td>
        <td>${orden.number_of_people}</td>
        <td><span class="${claseEstado}">${nombreEstado}</span></td>
        <td>Bs ${parseFloat(orden.total_amount || 0).toFixed(2)}</td>
        <td>Bs ${parseFloat(orden.paid_amount || 0).toFixed(2)}</td>
        <td>${horaApertura}</td>
        <td class="acciones">
            <button class="btn-accion btn-ver" onclick="abrirVerDetalle(${orden.id})" title="ver detalle">
                <i class="fa-solid fa-eye"></i>
            </button>
            ${esPendiente || esParcial ? `
                <button class="btn-accion btn-pago" onclick="abrirCobrar(${orden.id})" title="cobrar">
                    <i class="fa-solid fa-dollar-sign"></i>
                </button>
            ` : ''}
            ${esPendiente ? `
                <button class="btn-accion btn-editar" onclick="abrirEditar(${orden.id})" title="editar orden">
                    <i class="fa-solid fa-pen"></i>
                </button>
            ` : ''}
            ${botonesRenta}
            ${puedeAnular ? `
                <button class="btn-accion btn-anular" onclick="abrirAnular(${orden.id})" title="anular orden">
                    <i class="fa-solid fa-ban"></i>
                </button>
            ` : ''}
        </td>
    `;
    
    return tr;
}

async function cargarEstadisticas() {
    try {
        const ordenesActivas = ordenesCache.filter(o => 
            o.order_status_id === 1 || o.order_status_id === 3
        );
        
        const cuartosOcupados = ordenesActivas.filter(o => {
            const espacio = espaciosCache.find(e => e.id === o.space_id);
            return espacio && espacio.space_type_id === 1;
        }).length;
        
        const mesasOcupadas = ordenesActivas.filter(o => {
            const espacio = espaciosCache.find(e => e.id === o.space_id);
            return espacio && espacio.space_type_id === 2;
        }).length;
        
        const hoy = new Date().toISOString().split('T')[0];
        const ingresosDia = ordenesCache
            .filter(o => o.created_at && o.created_at.startsWith(hoy))
            .reduce((sum, o) => sum + parseFloat(o.paid_amount || 0), 0);
        
        document.getElementById('statOrdenes').textContent = ordenesActivas.length;
        document.getElementById('statCuartos').textContent = cuartosOcupados;
        document.getElementById('statMesas').textContent = mesasOcupadas;
        document.getElementById('statIngresos').textContent = `Bs ${ingresosDia.toFixed(2)}`;
        
    } catch (error) {
        console.error('error al cargar estadisticas:', error);
    }
}

function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function cerrarModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

async function abrirVerDetalle(orderId) {
    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { headers: getHeaders() });
        if (!response.ok) throw new Error('error al cargar detalle');
        
        const orden = await response.json();
        
        document.getElementById('detalleFolio').textContent = orden.folio;
        document.getElementById('detalleEspacio').textContent = orden.space?.name || 'N/A';
        document.getElementById('detallePersonas').textContent = orden.number_of_people;
        document.getElementById('detalleEstado').textContent = orden.status?.name || 'Pendiente';
        document.getElementById('detalleEmpleado').textContent = orden.user ? `${orden.user.first_name} ${orden.user.last_name || ''}` : 'N/A';
        
        document.getElementById('detalleApertura').textContent = formatearFechaConAMPM(orden.opened_at);
        
        const total = parseFloat(orden.total_amount || 0);
        const pagado = parseFloat(orden.paid_amount || 0);
        
        document.getElementById('detalleTotal').textContent = `Bs ${total.toFixed(2)}`;
        document.getElementById('detallePagado').textContent = `Bs ${pagado.toFixed(2)}`;
        document.getElementById('detallePendiente').textContent = `Bs ${(total - pagado).toFixed(2)}`;
        
        if (orden.notes) {
            document.getElementById('detalleNotasContainer').style.display = 'block';
            document.getElementById('detalleNotas').textContent = orden.notes;
        } else {
            document.getElementById('detalleNotasContainer').style.display = 'none';
        }
        
        const tbodyProductos = document.getElementById('detalleProductos');
        tbodyProductos.innerHTML = '';
        
        if (orden.items && orden.items.length > 0) {
            orden.items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.product?.name || 'Producto'}</td>
                    <td>${item.quantity}</td>
                    <td>Bs ${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                    <td>Bs ${parseFloat(item.subtotal || 0).toFixed(2)}</td>
                `;
                tbodyProductos.appendChild(tr);
            });
        } else {
            tbodyProductos.innerHTML = '<tr><td colspan="4" class="sin-datos">sin productos</td></tr>';
        }
        
        const rentasOrden = rentasCache.filter(r => r.order_id === orden.id);
        const tbodyRentas = document.getElementById('detalleRentas');
        if (tbodyRentas) {
            tbodyRentas.innerHTML = '';
            if (rentasOrden.length > 0) {
                rentasOrden.forEach(renta => {
                    const tr = document.createElement('tr');
                    
                    const inicioStr = formatearFechaConAMPM(renta.start_time);
                    const finStr = renta.end_time ? formatearFechaConAMPM(renta.end_time) : 'en curso';
                    
                    const horasTotales = parseFloat(renta.total_hours || 0);
                    const horasEnteras = Math.floor(horasTotales);
                    const minutosRestantes = Math.round((horasTotales - horasEnteras) * 60);
                    
                    let textoDuracion = '';
                    if (renta.is_active) {
                        textoDuracion = 'en curso';
                    } else if (horasEnteras > 0 && minutosRestantes > 0) {
                        textoDuracion = `${horasEnteras}h ${minutosRestantes}m`;
                    } else if (horasEnteras > 0) {
                        textoDuracion = `${horasEnteras}h`;
                    } else {
                        textoDuracion = `${minutosRestantes}m`;
                    }
                    
                    tr.innerHTML = `
                        <td>${inicioStr}</td>
                        <td>${finStr}</td>
                        <td>${textoDuracion}</td>
                        <td>Bs ${parseFloat(renta.total_amount || 0).toFixed(2)}</td>
                        <td>${renta.is_active ? '<span class="estado-parcial">Activa</span>' : '<span class="estado-pagado">Finalizada</span>'}</td>
                    `;
                    tbodyRentas.appendChild(tr);
                });
            } else {
                tbodyRentas.innerHTML = '<tr><td colspan="5" class="sin-datos">sin rentas registradas</td></tr>';
            }
        }
        
        const listaPagos = document.getElementById('detallePagosLista');
        listaPagos.innerHTML = '';
        
        if (orden.payments && orden.payments.length > 0) {
            orden.payments.forEach(pago => {
                const fechaPagoStr = pago.payment_date || pago.created_at;
                const div = document.createElement('div');
                div.className = 'pago-item';
                div.innerHTML = `
                    <div class="pago-item-info">
                        <span class="pago-item-metodo">${pago.payment_method?.name || 'N/A'}</span>
                        <span class="pago-item-fecha">${formatearFechaConAMPM(fechaPagoStr)}</span>
                    </div>
                    <span class="pago-item-monto">Bs ${parseFloat(pago.amount || 0).toFixed(2)}</span>
                `;
                listaPagos.appendChild(div);
            });
        } else {
            listaPagos.innerHTML = '<p class="sin-datos">sin pagos registrados</p>';
        }
        
        abrirModal('modalVerDetalle');
        
    } catch (error) {
        console.error('error al cargar detalle:', error);
        alert('error al cargar el detalle de la orden');
    }
}

function abrirCobrar(orderId) {
    console.log('Abriendo cobro para orden:', orderId);
    
    const orden = ordenesCache.find(o => o.id === orderId);
    if (!orden) {
        console.error('Orden no encontrada:', orderId);
        alert('error: orden no encontrada');
        return;
    }
    
    const pagoOrderId = document.getElementById('pagoOrderId');
    const cobrarFolio = document.getElementById('cobrarFolio');
    const cobrarTotal = document.getElementById('cobrarTotal');
    const cobrarPagado = document.getElementById('cobrarPagado');
    const cobrarPendiente = document.getElementById('cobrarPendiente');
    const formPago = document.getElementById('formPago');
    const pagoMonto = document.getElementById('pagoMonto');
    const pagoTipo = document.getElementById('pagoTipo');
    
    if (!pagoOrderId) {
        console.error('No se encontro el input pagoOrderId');
        alert('error: el formulario de pago no esta configurado correctamente');
        return;
    }
    
    const total = parseFloat(orden.total_amount || 0);
    const pagado = parseFloat(orden.paid_amount || 0);
    const pendiente = total - pagado;
    
    console.log('Total:', total, 'Pagado:', pagado, 'Pendiente:', pendiente);
    
    pagoOrderId.value = orderId;
    if (cobrarFolio) cobrarFolio.textContent = orden.folio;
    if (cobrarTotal) cobrarTotal.textContent = `Bs ${total.toFixed(2)}`;
    if (cobrarPagado) cobrarPagado.textContent = `Bs ${pagado.toFixed(2)}`;
    if (cobrarPendiente) cobrarPendiente.textContent = `Bs ${pendiente.toFixed(2)}`;
    
    if (formPago) formPago.reset();
    
    if (pagoMonto) {
        pagoMonto.value = pendiente.toFixed(2);
        pagoMonto.max = pendiente;
    }
    
    if (pagoTipo) {
        pagoTipo.value = pendiente <= 0.01 ? '1' : '2';
    }
    
    abrirModal('modalCobrar');
}

async function abrirEditar(orderId) {
    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { headers: getHeaders() });
        if (!response.ok) throw new Error('error al cargar orden');
        
        ordenActual = await response.json();
        
        document.getElementById('editarFolio').textContent = ordenActual.folio;
        document.getElementById('editarEspacio').textContent = ordenActual.space?.name || 'N/A';
        document.getElementById('editarEstado').textContent = ordenActual.status?.name || 'Pendiente';
        
        mostrarCatalogoEditar();
        actualizarItemsEditar();
        
        document.getElementById('editarBuscarProducto').value = '';
        
        abrirModal('modalEditar');
        
    } catch (error) {
        console.error('error al cargar orden:', error);
        alert('error al cargar la orden');
    }
}

function mostrarCatalogoEditar(filtro = '') {
    const contenedor = document.getElementById('editarCatalogo');
    
    if (!contenedor) {
        console.error('No se encontro el contenedor editarCatalogo');
        return;
    }
    
    contenedor.innerHTML = '';
    
    const productosFiltrados = productosCache.filter(p => 
        p.is_active && p.name.toLowerCase().includes(filtro.toLowerCase())
    );
    
    if (productosFiltrados.length === 0) {
        contenedor.innerHTML = '<p class="sin-datos" style="grid-column:1/-1;">no se encontraron productos</p>';
        return;
    }
    
    productosFiltrados.forEach(producto => {
        const sinStock = producto.current_stock <= 0;
        const card = document.createElement('div');
        card.className = `producto-card ${sinStock ? 'sin-stock' : ''}`;
        card.innerHTML = `
            <div class="producto-icono"><i class="fa-solid fa-wine-bottle"></i></div>
            <div class="producto-nombre">${producto.name}</div>
            <div class="producto-precio">Bs ${parseFloat(producto.sale_price).toFixed(2)}</div>
            <div class="producto-stock">Stock: ${producto.current_stock}</div>
        `;
        
        if (!sinStock) {
            card.addEventListener('click', () => abrirModalCantidad(producto));
        }
        
        contenedor.appendChild(card);
    });
}

function actualizarItemsEditar() {
    const tbody = document.getElementById('editarItemsOrden');
    tbody.innerHTML = '';
    
    if (!ordenActual.items || ordenActual.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="sin-datos">sin productos en la orden</td></tr>';
        return;
    }
    
    ordenActual.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.product?.name || 'Producto'}</td>
            <td>${item.quantity}</td>
            <td>Bs ${parseFloat(item.unit_price || 0).toFixed(2)}</td>
            <td>Bs ${parseFloat(item.subtotal || 0).toFixed(2)}</td>
            <td>
                <button class="btn-eliminar-item" onclick="eliminarItemOrden(${item.id})" title="eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalCantidad(producto) {
    console.log('Abriendo modal cantidad para producto:', producto);
    
    const cantidadProductId = document.getElementById('cantidadProductId');
    const cantidadProductoNombre = document.getElementById('cantidadProductoNombre');
    const cantidadProductoStock = document.getElementById('cantidadProductoStock');
    const cantidadInput = document.getElementById('cantidadInput');
    
    if (!cantidadProductId || !cantidadProductoNombre || !cantidadProductoStock || !cantidadInput) {
        console.error('No se encontraron los elementos del modal de cantidad');
        alert('error: el modal de cantidad no esta configurado correctamente');
        return;
    }
    
    cantidadProductId.value = producto.id;
    cantidadProductoNombre.textContent = producto.name;
    cantidadProductoStock.textContent = `Stock disponible: ${producto.current_stock}`;
    cantidadInput.value = 1;
    cantidadInput.max = producto.current_stock;
    
    abrirModal('modalCantidad');
}

async function eliminarItemOrden(orderItemId) {
    if (!ordenActual) return;
    if (!confirm('eliminar este producto de la orden?')) return;
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/orders/${ordenActual.id}/items/${orderItemId}`, 
            { method: 'DELETE', headers: getHeaders() }
        );
        
        if (response.ok) {
            const res = await fetch(`${API_BASE_URL}/orders/${ordenActual.id}`, { headers: getHeaders() });
            ordenActual = await res.json();
            actualizarItemsEditar();
            await cargarOrdenes();
            await cargarRentas();
            await cargarEstadisticas();
            await cargarDatosBase();
            mostrarCatalogoEditar(document.getElementById('editarBuscarProducto').value);
        } else {
            const error = await response.json();
            alert(error.message || 'error al eliminar el producto');
        }
    } catch (error) {
        console.error('error al eliminar item:', error);
        alert('error al eliminar el producto');
    }
}

function abrirAnular(orderId) {
    const rentaActiva = rentasCache.find(r => r.order_id === orderId && r.is_active);
    if (rentaActiva) {
        alert('no se puede anular la orden. primero detén la renta activa.');
        return;
    }
    
    const orden = ordenesCache.find(o => o.id === orderId);
    if (!orden) return;
    
    document.getElementById('anularOrderId').value = orderId;
    document.getElementById('anularFolio').textContent = orden.folio;
    
    abrirModal('modalAnular');
}

async function iniciarRenta(orderId) {
    if (!confirm('iniciar la renta del cuarto? el tiempo comenzara a contar.')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}/rentals`, {
            method: 'POST',
            headers: getHeaders()
        });
        
        if (response.ok) {
            const nuevaRenta = await response.json();
            rentasCache.push(nuevaRenta);
            
            alert('renta iniciada correctamente');
            
            await cargarOrdenes();
            await cargarEstadisticas();
        } else {
            const error = await response.json();
            alert(error.message || 'error al iniciar la renta');
        }
    } catch (error) {
        console.error('error al iniciar renta:', error);
        alert('error al iniciar la renta');
    }
}

async function detenerRenta(rentalId) {
    if (!confirm('detener la renta? se calculara el total de horas.')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/rentals/${rentalId}/stop`, {
            method: 'PUT',
            headers: getHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            
            const index = rentasCache.findIndex(r => r.id === rentalId);
            if (index !== -1) {
                rentasCache[index] = data.rental || data;
            }
            
            alert(`renta detenida correctamente\nhoras: ${data.total_hours}\nmonto: Bs ${parseFloat(data.total_amount).toFixed(2)}`);
            
            await cargarOrdenes();
            await cargarEstadisticas();
        } else {
            const error = await response.json();
            alert(error.message || 'error al detener la renta');
        }
    } catch (error) {
        console.error('error al detener renta:', error);
        alert('error al detener la renta');
    }
}

function configurarBotones() {
    document.getElementById('btnNuevaOrden').addEventListener('click', () => {
        window.location.href = 'nueva_orden.html';
    });
}

function configurarFiltros() {
    const inputBusqueda = document.getElementById('buscarOrden');
    const filtroEstado = document.getElementById('filtroEstado');
    const filtroEspacio = document.getElementById('filtroEspacio');
    
    if (inputBusqueda) inputBusqueda.addEventListener('input', filtrarOrdenes);
    if (filtroEstado) filtroEstado.addEventListener('change', filtrarOrdenes);
    if (filtroEspacio) filtroEspacio.addEventListener('change', filtrarOrdenes);
}

function filtrarOrdenes() {
    const busqueda = document.getElementById('buscarOrden').value.toLowerCase();
    const estado = document.getElementById('filtroEstado').value;
    const espacio = document.getElementById('filtroEspacio').value;
    
    const filas = document.querySelectorAll('#cuerpoTablaOrdenes tr');
    
    filas.forEach(fila => {
        if (!fila.querySelector('td')) return;
        
        const folio = fila.querySelector('td:nth-child(1)').textContent.toLowerCase();
        const espacioTexto = fila.querySelector('td:nth-child(2)').textContent.toLowerCase();
        const estadoTexto = fila.querySelector('td:nth-child(4)').textContent.toLowerCase();
        
        let mostrar = true;
        
        if (busqueda && !folio.includes(busqueda) && !espacioTexto.includes(busqueda)) {
            mostrar = false;
        }
        
        if (estado && !estadoTexto.includes(estado)) {
            mostrar = false;
        }
        
        fila.style.display = mostrar ? '' : 'none';
    });
}

function configurarFormularios() {
    // formulario de pago
    const formPago = document.getElementById('formPago');
    
    if (formPago) {
        formPago.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            console.log('=== INICIANDO PAGO ===');
            
            const orderId = document.getElementById('pagoOrderId').value;
            const montoStr = document.getElementById('pagoMonto').value;
            const metodoId = parseInt(document.getElementById('pagoMetodo').value);
            const tipoId = parseInt(document.getElementById('pagoTipo').value);
            const referencia = document.getElementById('pagoReferencia').value;
            const notas = document.getElementById('pagoNotas').value;
            
            const monto = parseFloat(montoStr.replace(',', '.'));
            
            console.log('Order ID:', orderId, 'Monto:', monto, 'Metodo:', metodoId, 'Tipo:', tipoId);
            
            if (!orderId) {
                alert('error: no hay orden seleccionada');
                return;
            }
            
            if (!monto || monto <= 0) {
                alert('ingrese un monto valido mayor a 0');
                document.getElementById('pagoMonto').focus();
                return;
            }
            
            if (!metodoId) {
                alert('seleccione un metodo de pago');
                document.getElementById('pagoMetodo').focus();
                return;
            }
            
            if (!tipoId) {
                alert('seleccione un tipo de pago');
                document.getElementById('pagoTipo').focus();
                return;
            }
            
            const data = {
                amount: monto,
                payment_method_id: metodoId,
                payment_type_id: tipoId,
                reference: referencia || null,
                notes: notas || null
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/orders/${orderId}/payments`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                
                console.log('Status:', response.status);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('Pago exitoso:', result);
                    
                    alert('pago registrado exitosamente');
                    cerrarModal('modalCobrar');
                    await cargarOrdenes();
                    await cargarRentas();
                    await cargarEstadisticas();
                } else {
                    const error = await response.json();
                    console.error('Error del servidor:', error);
                    const mensaje = error.message || Object.values(error.errors || {}).flat().join(', ');
                    alert('error al registrar el pago: ' + mensaje);
                }
            } catch (error) {
                console.error('Error de red:', error);
                alert('error de conexion al registrar el pago');
            }
        });
    }
    
    // boton confirmar anular
    const btnAnular = document.getElementById('btnConfirmarAnular');
    if (btnAnular) {
        btnAnular.addEventListener('click', async () => {
            const orderId = document.getElementById('anularOrderId').value;
            
            const rentaActiva = rentasCache.find(r => r.order_id == orderId && r.is_active);
            if (rentaActiva) {
                alert('no se puede anular la orden. primero detén la renta activa.');
                cerrarModal('modalAnular');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                });
                
                if (response.ok) {
                    alert('orden anulada exitosamente');
                    cerrarModal('modalAnular');
                    await cargarOrdenes();
                    await cargarRentas();
                    await cargarEstadisticas();
                } else {
                    const error = await response.json();
                    alert(error.message || 'error al anular la orden');
                }
            } catch (error) {
                console.error('error al anular orden:', error);
                alert('error al anular la orden');
            }
        });
    }
    
    // buscador en modal editar
    const buscarEditar = document.getElementById('editarBuscarProducto');
    if (buscarEditar) {
        buscarEditar.addEventListener('input', (e) => {
            mostrarCatalogoEditar(e.target.value);
        });
    }
    
    // boton confirmar cantidad
    const btnCantidad = document.getElementById('btnConfirmarCantidad');
    if (btnCantidad) {
        btnCantidad.addEventListener('click', async () => {
            const productId = parseInt(document.getElementById('cantidadProductId').value);
            const cantidad = parseInt(document.getElementById('cantidadInput').value);
            
            if (!cantidad || cantidad < 1) {
                alert('cantidad invalida');
                return;
            }
            
            try {
                const response = await fetch(
                    `${API_BASE_URL}/orders/${ordenActual.id}/items`, 
                    {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            product_id: productId,
                            quantity: cantidad
                        })
                    }
                );
                
                if (response.ok) {
                    cerrarModal('modalCantidad');
                    const res = await fetch(`${API_BASE_URL}/orders/${ordenActual.id}`, { headers: getHeaders() });
                    ordenActual = await res.json();
                    actualizarItemsEditar();
                    await cargarOrdenes();
                    await cargarRentas();
                    await cargarEstadisticas();
                    await cargarDatosBase();
                    mostrarCatalogoEditar(document.getElementById('editarBuscarProducto').value);
                } else {
                    const error = await response.json();
                    alert(error.message || 'error al agregar el producto');
                }
            } catch (error) {
                console.error('error al agregar producto:', error);
                alert('error al agregar el producto');
            }
        });
    }
}

function configurarLogout() {
    const logoutBtn = document.querySelector('.link-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch(`${API_BASE_URL}/logout`, {
                    method: 'POST',
                    headers: getHeaders()
                });
            } catch (error) {
                console.error('error al cerrar sesion:', error);
            } finally {
                localStorage.removeItem('token');
                localStorage.removeItem('usuario');
                window.location.href = 'index.html';
            }
        });
    }
}