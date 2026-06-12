const userDataStorage = JSON.parse(localStorage.getItem('usuario') || '{}');
const userRoleStorage = userDataStorage.role?.name || '';
const isAdminStorage = userRoleStorage === 'Administrador';

if (isAdminStorage) {
    document.body.classList.add('es-admin');
    console.log('✅ es-admin agregado desde localStorage');
}
const API_URL = 'http://localhost:8000/api';
const token = localStorage.getItem('token');
let USER_DATA = {};

try {
    USER_DATA = JSON.parse(localStorage.getItem('usuario') || '{}');
} catch (e) {
    console.error('Error al parsear usuario:', e);
}

// Cache de datos
let pagosCache = [];
let metodosPagoCache = [];

if (!token) {
    window.location.href = "login.html";
}

/* funcion API CALL */
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
        window.location.href = "login.html";
        return;
    }

    if (!respuesta.ok) {
        throw new Error(`Error ${respuesta.status}`);
    }

    return respuesta.json();
}

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

        // APLICAR CLASE INMEDIATAMENTE
        if (IS_ADMIN) {
            document.body.classList.add('es-admin');
            console.log('✅ Usuario es ADMIN');
        } else {
            document.body.classList.remove('es-admin');
            if (badgeRol) {
                badgeRol.textContent = "Empleado";
                badgeRol.classList.add("badge-empleado");
            }
            console.log('❌ Usuario es EMPLEADO');
        }
 
    } catch (error) {
        console.error('Error al configurar rol:', error);
        // Por defecto, asumir que no es admin
        document.body.classList.remove('es-admin');
    }
}

// Asegurar que se ejecute al cargar
document.addEventListener('DOMContentLoaded', () => {
    configurarRol();
    configurarFiltros();
    cargarDatos();
});

/* CARGAR DATOS */
async function cargarDatos() {
    try {
        const [pagos, metodos] = await Promise.all([
            apiCall('/payments'),
            apiCall('/payment-methods')
        ]);

        pagosCache = pagos;
        metodosPagoCache = metodos;

        llenarSelectMetodos();
        renderizarPagos();
        actualizarEstadisticas();

        console.log('Pagos cargados:', pagosCache.length);

    } catch (error) {
        console.error('Error al cargar datos:', error);
    }
}

/* LLENAR SELECT DE MÉTODOS */
function llenarSelectMetodos() {
    const select = document.getElementById('filtroMetodo');
    if (!select) return;
    
    select.innerHTML = '<option value="">Todos los métodos</option>';
    metodosPagoCache.forEach(m => {
        select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });
}

/* RENDERIZAR TABLA */
function renderizarPagos() {
    const tbody = document.getElementById('tbodyPagos');
    if (!tbody) return;

    const busqueda = document.getElementById('buscarPago').value.toLowerCase();
    const metodoFiltro = document.getElementById('filtroMetodo').value;

    let pagosFiltrados = [...pagosCache];

    // filtro por busqueda
    if (busqueda) {
        pagosFiltrados = pagosFiltrados.filter(p =>
            p.folio?.toLowerCase().includes(busqueda) ||
            p.space_name?.toLowerCase().includes(busqueda) ||
            p.user_name?.toLowerCase().includes(busqueda) ||
            p.reference?.toLowerCase().includes(busqueda)
        );
    }

    // filtro por metodo
    if (metodoFiltro) {
        pagosFiltrados = pagosFiltrados.filter(p =>
            p.payment_method_id == metodoFiltro
        );
    }

    tbody.innerHTML = '';

    if (pagosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:20px; color:#9ca3af;">
                    No se encontraron pagos
                </td>
            </tr>
        `;
        return;
    }

    pagosFiltrados.forEach(pago => {
        // icono y clase segun metodo
        let iconoMetodo = '';
        let claseMetodo = '';

        const metodo = pago.payment_method_name?.toLowerCase() || '';

        if (metodo === 'efectivo') {
            iconoMetodo = 'fa-money-bill-wave';
            claseMetodo = 'efectivo';
        } else if (metodo === 'qr') {
            iconoMetodo = 'fa-qrcode';
            claseMetodo = 'qr';
        } else if (metodo === 'tarjeta') {
            iconoMetodo = 'fa-credit-card';
            claseMetodo = 'tarjeta';
        } else {
            iconoMetodo = 'fa-receipt';
            claseMetodo = 'efectivo';
        }

        // icono segUn tipo de espacio
        let iconoEspacio = '';
        if (pago.space_type === 'Cuarto') {
            iconoEspacio = '<i class="fa-solid fa-door-open" style="color:#7c3aed;margin-right:6px"></i>';
        } else if (pago.space_type === 'Mesa') {
            iconoEspacio = '<i class="fa-solid fa-table" style="color:#059669;margin-right:6px"></i>';
        } else if (pago.space_type === 'Barra') {
            iconoEspacio = '<i class="fa-solid fa-martini-glass" style="color:#d97706;margin-right:6px"></i>';
        }

        const fecha = new Date(pago.payment_date).toLocaleString('es-BO');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${pago.folio}</strong></td>
            <td>${iconoEspacio}${pago.space_name}</td>
            <td><strong>Bs ${parseFloat(pago.amount).toFixed(2)}</strong></td>
            <td>
                <span class="badge-metodo ${claseMetodo}">
                    <i class="fa-solid ${iconoMetodo}"></i>
                    ${pago.payment_method_name}
                </span>
            </td>
            <td>${pago.payment_type_name}</td>
            <td>${pago.reference || '-'}</td>
            <td>${fecha}</td>
            <td class="acciones">
                <button class="btn-ver btn-recibo" onclick="verRecibo(${pago.id})">
                    <i class="fa-solid fa-file-invoice"></i> Ver
                </button>
                <button class="btn-imprimir" onclick="imprimirPago(${pago.id})">
                    <i class="fa-solid fa-print"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/* ESTADÍSTICAS */
function actualizarEstadisticas() {
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const mesHoy = hoy.getMonth();
    const anioHoy = hoy.getFullYear();

    // Cobrado hoy
    const cobradoHoy = pagosCache
        .filter(p => {
            const fecha = new Date(p.payment_date);
            return fecha.getDate() === diaHoy &&
                   fecha.getMonth() === mesHoy &&
                   fecha.getFullYear() === anioHoy;
        })
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // Cobrado mes
    const cobradoMes = pagosCache
        .filter(p => {
            const fecha = new Date(p.payment_date);
            return fecha.getMonth() === mesHoy &&
                   fecha.getFullYear() === anioHoy;
        })
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // Pagos QR
    const pagosQR = pagosCache.filter(p => 
        p.payment_method_name?.toLowerCase() === 'qr'
    ).length;

    // Pagos Efectivo
    const pagosEfectivo = pagosCache.filter(p => 
        p.payment_method_name?.toLowerCase() === 'efectivo'
    ).length;

    document.getElementById('statCobradoHoy').textContent = `Bs ${cobradoHoy.toFixed(2)}`;
    document.getElementById('statCobradoMes').textContent = `Bs ${cobradoMes.toFixed(2)}`;
    document.getElementById('statPagosQR').textContent = pagosQR;
    document.getElementById('statPagosEfectivo').textContent = pagosEfectivo;
}

/* VER RECIBO */
function verRecibo(pagoId) {
    const pago = pagosCache.find(p => p.id === pagoId);
    if (!pago) return;

    const contenido = document.querySelector('.recibo-info');
    if (!contenido) return;

    contenido.innerHTML = `
        <p><strong>ID Pago:</strong> ${pago.id}</p>
        <p><strong>Folio:</strong> ${pago.folio}</p>
        <p><strong>Espacio:</strong> ${pago.space_name}</p>
        <p><strong>Monto:</strong> Bs ${parseFloat(pago.amount).toFixed(2)}</p>
        <p><strong>Método:</strong> ${pago.payment_method_name}</p>
        <p><strong>Tipo:</strong> ${pago.payment_type_name}</p>
        <p><strong>Referencia:</strong> ${pago.reference || 'Sin referencia'}</p>
        <p><strong>Fecha:</strong> ${new Date(pago.payment_date).toLocaleString('es-BO')}</p>
        <p><strong>Usuario:</strong> ${pago.user_name}</p>
        ${pago.notes ? `
            <p><strong>Notas:</strong></p>
            <p style="background:#f9fafb; padding:12px; border-radius:8px; margin-top:6px;">
                ${pago.notes}
            </p>
        ` : ''}
    `;

    document.getElementById('modalRecibo').style.display = 'flex';
}

/* IMPRIMIR */
function imprimirPago(pagoId) {
    verRecibo(pagoId);
    setTimeout(() => {
        window.print();
    }, 300);
}

/* RECIBO */
const modalRecibo = document.getElementById("modalRecibo");

if (modalRecibo) {
    // Cerrar al hacer clic fuera
    window.addEventListener("click", (e) => {
        if (e.target === modalRecibo) {
            modalRecibo.style.display = "none";
        }
    });
}

function cerrarModalRecibo() {
    document.getElementById('modalRecibo').style.display = 'none';
}

/* FILTROS */
function configurarFiltros() {
    const buscarPago = document.getElementById('buscarPago');
    const filtroMetodo = document.getElementById('filtroMetodo');

    if (buscarPago) {
        buscarPago.addEventListener('input', renderizarPagos);
    }

    if (filtroMetodo) {
        filtroMetodo.addEventListener('change', renderizarPagos);
    }
}

/* LOGOUT */
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
            window.location.href = 'login.html';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    configurarRol();
    configurarFiltros();
    cargarDatos();
});