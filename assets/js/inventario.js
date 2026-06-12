const API_BASE_URL = 'http://localhost:8000/api';
let TOKEN = localStorage.getItem('token');
let USER_DATA = {};
 
try {
    USER_DATA = JSON.parse(localStorage.getItem('usuario') || '{}');
} catch (e) {
    console.error('Error al parsear usuario:', e);
}
 
let productosCache = [];
let espaciosCache = [];
let categoriasCache = [];
let unidadesCache = [];
let tiposEspacioCache = [];
let movimientosCache = [];
let ordenesCache = [];

const LIMITES = {
    precioMax: 9999.99,      // precio máximo de un producto
    costoMax: 9999.99,       // costo máximo
    stockMax: 999,           // stock máximo
    stockMinimoMax: 100,     // stock mínimo máximo
    capacidadMax: 20,        // capacidad máxima de espacios
    precioHoraMax: 999.99    // precio por hora máximo
};
 
if (!TOKEN) {
    window.location.href = 'index.html';
} else {
    document.addEventListener('DOMContentLoaded', iniciarPagina);
}
 
function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
    };
}
 
async function iniciarPagina() {
    try {
        document.getElementById('nombreUsuario').textContent =
            `${USER_DATA.first_name} ${USER_DATA.last_name || ''}`;
        document.getElementById('badgeRol').textContent = USER_DATA.role?.name || 'Empleado';

        controlarRoles();
        configurarTabs();
        configurarBotones();
        configurarBuscadores();
        configurarModales();
        configurarFormularios();
        configurarValidaciones();

        await cargarDatosBase();
        await cargarOrdenes();
       
        renderizarProductos();
        renderizarEspacios();
        actualizarEstadisticas();

        console.log('pagina de inventario cargada correctamente');
    } catch (error) {
        console.error('error al iniciar pagina:', error);
        actualizarEstadisticas();
    }
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
        const fetchConError = async (url) => {
            try {
                const response = await fetch(url, { headers: getHeaders() });
                if (response.ok) {
                    return await response.json();
                } else {
                    console.warn(`warning: ${url} respondio ${response.status}`);
                    return [];
                }
            } catch (error) {
                console.warn(`warning: error al cargar ${url}:`, error.message);
                return [];
            }
        };

        const [productos, espacios, categorias, unidades, tiposEspacio, movimientos] = await Promise.all([
            fetchConError(`${API_BASE_URL}/products`),
            fetchConError(`${API_BASE_URL}/spaces`),
            fetchConError(`${API_BASE_URL}/product-categories`),
            fetchConError(`${API_BASE_URL}/measure-units`),
            fetchConError(`${API_BASE_URL}/space-types`),
            fetchConError(`${API_BASE_URL}/inventory-movements`)
        ]);

        productosCache = productos;
        espaciosCache = espacios;
        categoriasCache = categorias;
        unidadesCache = unidades;
        tiposEspacioCache = tiposEspacio;
        movimientosCache = movimientos;

        llenarSelectCategorias();
        llenarSelectUnidades();
        llenarSelectTiposEspacio();

    } catch (error) {
        console.error('error critico al cargar datos base:', error);
    }
}
 
async function cargarOrdenes() {
    try {
        const response = await fetch(`${API_BASE_URL}/orders`, { headers: getHeaders() });
        if (response.ok) {
            ordenesCache = await response.json();
        }
    } catch (error) {
        console.error('Error al cargar órdenes:', error);
    }
}
 
function llenarSelectCategorias() {
    const filtro = document.getElementById('filtroCategoriaProd');
    filtro.innerHTML = '<option value="">Todas las categorías</option>';
    categoriasCache.forEach(cat => {
        filtro.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
 
    const nuevo = document.getElementById('nuevoProdCategoria');
    nuevo.innerHTML = '<option value="">Seleccionar categoría</option>';
    categoriasCache.forEach(cat => {
        nuevo.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
 
    const editar = document.getElementById('editProdCategoria');
    editar.innerHTML = '<option value="">Seleccionar categoría</option>';
    categoriasCache.forEach(cat => {
        editar.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
}
 
function llenarSelectUnidades() {
    const nuevo = document.getElementById('nuevoProdUnidad');
    nuevo.innerHTML = '<option value="">Seleccionar unidad</option>';
    unidadesCache.forEach(u => {
        nuevo.innerHTML += `<option value="${u.id}">${u.name}</option>`;
    });
 
    const editar = document.getElementById('editProdUnidad');
    editar.innerHTML = '<option value="">Seleccionar unidad</option>';
    unidadesCache.forEach(u => {
        editar.innerHTML += `<option value="${u.id}">${u.name}</option>`;
    });
}
 
function llenarSelectTiposEspacio() {
    const filtro = document.getElementById('filtroTipoEspacio');
    filtro.innerHTML = '<option value="">Todos los tipos</option>';
    tiposEspacioCache.forEach(t => {
        filtro.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
 
    const nuevo = document.getElementById('nuevoEspTipo');
    nuevo.innerHTML = '<option value="">Seleccionar tipo</option>';
    tiposEspacioCache.forEach(t => {
        nuevo.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
 
    const editar = document.getElementById('editEspTipo');
    editar.innerHTML = '<option value="">Seleccionar tipo</option>';
    tiposEspacioCache.forEach(t => {
        editar.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
}
 
function configurarTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-contenido');
    const txtBtn = document.getElementById('txtBtnNuevo');
 
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('activo'));
            tabPanels.forEach(p => p.classList.remove('activo'));
            btn.classList.add('activo');
            document.getElementById(btn.dataset.tab).classList.add('activo');
            txtBtn.textContent = btn.dataset.tab === 'productos'
                ? 'Nuevo Producto'
                : 'Nuevo Espacio';
        });
    });
}
 
function configurarBotones() {
    document.getElementById('btnNuevo').addEventListener('click', () => {
        const tabActivo = document.querySelector('.tab-btn.activo').dataset.tab;
        if (tabActivo === 'productos') {
            abrirNuevoProducto();
        } else {
            abrirNuevoEspacio();
        }
    });
 
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
                console.error('Error al cerrar sesión:', error);
            } finally {
                localStorage.removeItem('token');
                localStorage.removeItem('usuario');
                window.location.href = 'index.html';
            }
        });
    }
}
 
function configurarBuscadores() {
    document.getElementById('buscarProducto').addEventListener('input', renderizarProductos);
    document.getElementById('filtroCategoriaProd').addEventListener('change', renderizarProductos);
    document.getElementById('buscarEspacio').addEventListener('input', renderizarEspacios);
    document.getElementById('filtroTipoEspacio').addEventListener('change', renderizarEspacios);
}

function soloLetras(input) {
    input.addEventListener('input', function() {
        const valorLimpio = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        if (this.value !== valorLimpio) {
            this.value = valorLimpio;
        }
    });
   
    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const textoPegado = (e.clipboardData || window.clipboardData).getData('text');
        const textoLimpio = textoPegado.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        document.execCommand('insertText', false, textoLimpio);
    });
}

function soloLetrasYNumeros(input) {
    input.addEventListener('input', function() {
        const valorLimpio = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]/g, '');
        if (this.value !== valorLimpio) {
            this.value = valorLimpio;
        }
    });
   
    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const textoPegado = (e.clipboardData || window.clipboardData).getData('text');
        const textoLimpio = textoPegado.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]/g, '');
        document.execCommand('insertText', false, textoLimpio);
    });
}

function soloNumerosConLimite(input, maximo) {
    input.addEventListener('input', function() {
        let valor = this.value.replace(/[^0-9.]/g, '');
       
        const partes = valor.split('.');
        if (partes.length > 2) {
            valor = partes[0] + '.' + partes.slice(1).join('');
        }
       
        if (partes[1] && partes[1].length > 2) {
            valor = partes[0] + '.' + partes[1].substring(0, 2);
        }
       
        // aplicar límite
        const num = parseFloat(valor);
        if (!isNaN(num) && num > maximo) {
            valor = maximo.toString();
        }
       
        if (this.value !== valor) {
            this.value = valor;
        }
    });
   
    input.addEventListener('keydown', function(e) {
        if (e.key === '-' || e.key === '−') {
            e.preventDefault();
        }
    });
   
    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const textoPegado = (e.clipboardData || window.clipboardData).getData('text');
        let textoLimpio = textoPegado.replace(/[^0-9.]/g, '');
        const num = parseFloat(textoLimpio);
        if (!isNaN(num) && num > maximo) {
            textoLimpio = maximo.toString();
        }
        document.execCommand('insertText', false, textoLimpio);
    });
}

function soloEnterosConLimite(input, maximo) {
    input.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        const valor = parseInt(this.value);
        if (valor > maximo) {
            this.value = maximo.toString();
        }
    });
   
    input.addEventListener('keydown', function(e) {
        if (e.key === '-' || e.key === '−') {
            e.preventDefault();
        }
    });
   
    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const textoPegado = (e.clipboardData || window.clipboardData).getData('text');
        let textoLimpio = textoPegado.replace(/[^0-9]/g, '');
        const valor = parseInt(textoLimpio);
        if (valor > maximo) {
            textoLimpio = maximo.toString();
        }
        document.execCommand('insertText', false, textoLimpio);
    });
}

function validarNombre(input, errorId, permitirNumeros = false) {
    input.addEventListener('input', function() {
        const errorSpan = document.getElementById(errorId);
        const regex = permitirNumeros 
            ? /^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]+$/ 
            : /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
        const mensaje = permitirNumeros 
            ? '⚠️ Solo letras y números' 
            : '⚠️ Solo se permiten letras';
       
        if (this.value && !regex.test(this.value)) {
            this.classList.add('invalido');
            this.classList.remove('valido');
            if (errorSpan) {
                errorSpan.textContent = mensaje;
                errorSpan.classList.add('visible');
            }
        } else if (this.value.trim()) {
            this.classList.remove('invalido');
            this.classList.add('valido');
            if (errorSpan) errorSpan.classList.remove('visible');
        } else {
            this.classList.remove('invalido', 'valido');
            if (errorSpan) errorSpan.classList.remove('visible');
        }
    });
}

function validarCapacidad(input, errorId) {
    input.addEventListener('input', function() {
        const errorSpan = document.getElementById(errorId);
        const valor = parseInt(this.value);
       
        if (this.value && (isNaN(valor) || valor <= 0)) {
            this.classList.add('invalido');
            this.classList.remove('valido');
            if (errorSpan) {
                errorSpan.textContent = '⚠️ Debe ser mayor a 0';
                errorSpan.classList.add('visible');
            }
        } else if (valor > LIMITES.capacidadMax) {
            this.classList.add('invalido');
            this.classList.remove('valido');
            if (errorSpan) {
                errorSpan.textContent = `⚠️ Máximo ${LIMITES.capacidadMax} personas`;
                errorSpan.classList.add('visible');
            }
        } else if (this.value) {
            this.classList.remove('invalido');
            this.classList.add('valido');
            if (errorSpan) errorSpan.classList.remove('visible');
        } else {
            this.classList.remove('invalido', 'valido');
            if (errorSpan) errorSpan.classList.remove('visible');
        }
    });
}

function validarPrecio(input, errorId, maximo = LIMITES.precioMax) {
    input.addEventListener('input', function() {
        const errorSpan = document.getElementById(errorId);
        const valor = parseFloat(this.value);
       
        if (this.value && (isNaN(valor) || valor <= 0)) {
            this.classList.add('invalido');
            this.classList.remove('valido');
            if (errorSpan) {
                errorSpan.textContent = '⚠️ El precio debe ser mayor a 0';
                errorSpan.classList.add('visible');
            }
        } else if (valor > maximo) {
            this.classList.add('invalido');
            this.classList.remove('valido');
            if (errorSpan) {
                errorSpan.textContent = `⚠️ Máximo Bs ${maximo.toFixed(2)}`;
                errorSpan.classList.add('visible');
            }
        } else if (this.value) {
            this.classList.remove('invalido');
            this.classList.add('valido');
            if (errorSpan) errorSpan.classList.remove('visible');
        } else {
            this.classList.remove('invalido', 'valido');
            if (errorSpan) errorSpan.classList.remove('visible');
        }
    });
}

function validarStock(input, errorId, maximo = LIMITES.stockMax) {
    input.addEventListener('input', function() {
        const errorSpan = document.getElementById(errorId);
        const valor = parseInt(this.value);
       
        if (this.value && (isNaN(valor) || valor < 0)) {
            this.classList.add('invalido');
            this.classList.remove('valido');
            if (errorSpan) {
                errorSpan.textContent = '⚠️ No puede ser negativo';
                errorSpan.classList.add('visible');
            }
        } else if (valor > maximo) {
            this.classList.add('invalido');
            this.classList.remove('valido');
            if (errorSpan) {
                errorSpan.textContent = `⚠️ Máximo ${maximo} unidades`;
                errorSpan.classList.add('visible');
            }
        } else if (this.value !== '') {
            this.classList.remove('invalido');
            this.classList.add('valido');
            if (errorSpan) errorSpan.classList.remove('visible');
        } else {
            this.classList.remove('invalido', 'valido');
            if (errorSpan) errorSpan.classList.remove('visible');
        }
    });
}
 
function configurarValidaciones() {
    // === PRODUCTOS ===
    const nuevoProdNombre = document.getElementById('nuevoProdNombre');
    const nuevoProdPrecio = document.getElementById('nuevoProdPrecio');
    const nuevoProdStock = document.getElementById('nuevoProdStock');
    const nuevoProdMinimo = document.getElementById('nuevoProdMinimo');
    const nuevoProdCosto = document.getElementById('nuevoProdCosto');
   
    if (nuevoProdNombre) {
        soloLetras(nuevoProdNombre);
        validarNombre(nuevoProdNombre, 'errorNuevoProdNombre', false);
    }
    if (nuevoProdPrecio) {
        soloNumerosConLimite(nuevoProdPrecio, LIMITES.precioMax);
        validarPrecio(nuevoProdPrecio, 'errorNuevoProdPrecio', LIMITES.precioMax);
    }
    if (nuevoProdStock) {
        soloEnterosConLimite(nuevoProdStock, LIMITES.stockMax);
        validarStock(nuevoProdStock, 'errorNuevoProdStock', LIMITES.stockMax);
    }
    if (nuevoProdMinimo) {
        soloEnterosConLimite(nuevoProdMinimo, LIMITES.stockMinimoMax);
        validarStock(nuevoProdMinimo, 'errorNuevoProdMinimo', LIMITES.stockMinimoMax);
    }
    if (nuevoProdCosto) {
        soloNumerosConLimite(nuevoProdCosto, LIMITES.costoMax);
        validarPrecio(nuevoProdCosto, 'errorNuevoProdCosto', LIMITES.costoMax);
    }
 
    const editProdNombre = document.getElementById('editProdNombre');
    const editProdPrecio = document.getElementById('editProdPrecio');
    const editProdMinimo = document.getElementById('editProdMinimo');
    const editProdCosto = document.getElementById('editProdCosto');
    const editProdStockAgregar = document.getElementById('editProdStockAgregar');
   
    if (editProdNombre) {
        soloLetras(editProdNombre);
        validarNombre(editProdNombre, 'errorEditProdNombre', false);
    }
    if (editProdPrecio) {
        soloNumerosConLimite(editProdPrecio, LIMITES.precioMax);
        validarPrecio(editProdPrecio, 'errorEditProdPrecio', LIMITES.precioMax);
    }
    if (editProdMinimo) {
        soloEnterosConLimite(editProdMinimo, LIMITES.stockMinimoMax);
        validarStock(editProdMinimo, 'errorEditProdMinimo', LIMITES.stockMinimoMax);
    }
    if (editProdCosto) {
        soloNumerosConLimite(editProdCosto, LIMITES.costoMax);
        validarPrecio(editProdCosto, 'errorEditProdCosto', LIMITES.costoMax);
    }
    if (editProdStockAgregar) {
        soloEnterosConLimite(editProdStockAgregar, LIMITES.stockMax);
        editProdStockAgregar.addEventListener('input', calcularNuevoStock);
    }
 
    // === ESPACIOS ===
    const nuevoEspNombre = document.getElementById('nuevoEspNombre');
    const nuevoEspCapacidad = document.getElementById('nuevoEspCapacidad');
    const nuevoEspPrecioHora = document.getElementById('nuevoEspPrecioHora');
   
    if (nuevoEspNombre) {
        soloLetrasYNumeros(nuevoEspNombre);
        validarNombre(nuevoEspNombre, 'errorNuevoEspNombre', true);
    }
    if (nuevoEspCapacidad) {
        soloEnterosConLimite(nuevoEspCapacidad, LIMITES.capacidadMax);
        validarCapacidad(nuevoEspCapacidad, 'errorNuevoEspCapacidad');
    }
    if (nuevoEspPrecioHora) {
        soloNumerosConLimite(nuevoEspPrecioHora, LIMITES.precioHoraMax);
        validarPrecio(nuevoEspPrecioHora, 'errorNuevoEspPrecioHora', LIMITES.precioHoraMax);
    }
 
    const editEspNombre = document.getElementById('editEspNombre');
    const editEspCapacidad = document.getElementById('editEspCapacidad');
    const editEspPrecioHora = document.getElementById('editEspPrecioHora');
   
    if (editEspNombre) {
        soloLetrasYNumeros(editEspNombre);
        validarNombre(editEspNombre, 'errorEditEspNombre', true);
    }
    if (editEspCapacidad) {
        soloEnterosConLimite(editEspCapacidad, LIMITES.capacidadMax);
        validarCapacidad(editEspCapacidad, 'errorEditEspCapacidad');
    }
    if (editEspPrecioHora) {
        soloNumerosConLimite(editEspPrecioHora, LIMITES.precioHoraMax);
        validarPrecio(editEspPrecioHora, 'errorEditEspPrecioHora', LIMITES.precioHoraMax);
    }
}

function calcularNuevoStock() {
    const stockActualEl = document.getElementById('editProdStockActual');
    const stockAgregarEl = document.getElementById('editProdStockAgregar');
    const stockNuevoEl = document.getElementById('editProdStockNuevo');
    
    if (!stockActualEl || !stockAgregarEl || !stockNuevoEl) return;
    
    const stockActual = parseInt(stockActualEl.textContent) || 0;
    const stockAgregar = parseInt(stockAgregarEl.value) || 0;
    const stockNuevo = stockActual + stockAgregar;
    
    stockNuevoEl.textContent = stockNuevo;
    
    // cambiar color si es mayor al límite
    if (stockNuevo > LIMITES.stockMax) {
        stockNuevoEl.style.color = '#dc2626';
    } else {
        stockNuevoEl.style.color = '#059669';
    }
}

function validarFormNuevoProducto() {
    let valido = true;
   
    const nombre = document.getElementById('nuevoProdNombre');
    const errorNombre = document.getElementById('errorNuevoProdNombre');
    if (!nombre.value.trim()) {
        nombre.classList.add('invalido');
        errorNombre.textContent = '⚠️ El nombre es obligatorio';
        errorNombre.classList.add('visible');
        valido = false;
    } else {
        nombre.classList.remove('invalido');
        errorNombre.classList.remove('visible');
    }
   
    const precio = document.getElementById('nuevoProdPrecio');
    const errorPrecio = document.getElementById('errorNuevoProdPrecio');
    const precioValor = parseFloat(precio.value);
    if (!precio.value || isNaN(precioValor) || precioValor <= 0) {
        precio.classList.add('invalido');
        errorPrecio.textContent = '⚠️ El precio debe ser mayor a 0';
        errorPrecio.classList.add('visible');
        valido = false;
    } else if (precioValor > LIMITES.precioMax) {
        precio.classList.add('invalido');
        errorPrecio.textContent = `⚠️ Máximo Bs ${LIMITES.precioMax.toFixed(2)}`;
        errorPrecio.classList.add('visible');
        valido = false;
    } else {
        precio.classList.remove('invalido');
        errorPrecio.classList.remove('visible');
    }

    // validar stock
    const stock = document.getElementById('nuevoProdStock');
    const errorStock = document.getElementById('errorNuevoProdStock');
    const stockValor = parseInt(stock.value) || 0;
    if (stockValor > LIMITES.stockMax) {
        stock.classList.add('invalido');
        errorStock.textContent = `⚠️ Máximo ${LIMITES.stockMax} unidades`;
        errorStock.classList.add('visible');
        valido = false;
    }
   
    return valido;
}
 
function validarFormNuevoEspacio() {
    let valido = true;
   
    const nombre = document.getElementById('nuevoEspNombre');
    const errorNombre = document.getElementById('errorNuevoEspNombre');
    if (!nombre.value.trim()) {
        nombre.classList.add('invalido');
        errorNombre.textContent = '⚠️ El nombre es obligatorio';
        errorNombre.classList.add('visible');
        valido = false;
    } else {
        nombre.classList.remove('invalido');
        errorNombre.classList.remove('visible');
    }

    const capacidad = document.getElementById('nuevoEspCapacidad');
    const errorCapacidad = document.getElementById('errorNuevoEspCapacidad');
    if (capacidad && capacidad.value) {
        const valorCap = parseInt(capacidad.value);
        if (valorCap > LIMITES.capacidadMax) {
            capacidad.classList.add('invalido');
            if (errorCapacidad) {
                errorCapacidad.textContent = `⚠️ Máximo ${LIMITES.capacidadMax} personas`;
                errorCapacidad.classList.add('visible');
            }
            valido = false;
        } else if (valorCap <= 0) {
            capacidad.classList.add('invalido');
            if (errorCapacidad) {
                errorCapacidad.textContent = '⚠️ Debe ser mayor a 0';
                errorCapacidad.classList.add('visible');
            }
            valido = false;
        } else {
            capacidad.classList.remove('invalido');
            if (errorCapacidad) errorCapacidad.classList.remove('visible');
        }
    }

    // validar precio por hora
    const precioHora = document.getElementById('nuevoEspPrecioHora');
    if (precioHora && precioHora.value) {
        const valorPrecio = parseFloat(precioHora.value);
        if (valorPrecio > LIMITES.precioHoraMax) {
            precioHora.classList.add('invalido');
            valido = false;
            alert(`⚠️ El precio por hora no puede ser mayor a Bs ${LIMITES.precioHoraMax.toFixed(2)}`);
        }
    }
   
    return valido;
}
 
function validarFormEditarProducto() {
    let valido = true;
   
    const nombre = document.getElementById('editProdNombre');
    const errorNombre = document.getElementById('errorEditProdNombre');
    if (!nombre.value.trim()) {
        nombre.classList.add('invalido');
        errorNombre.textContent = '⚠️ El nombre es obligatorio';
        errorNombre.classList.add('visible');
        valido = false;
    } else {
        nombre.classList.remove('invalido');
        errorNombre.classList.remove('visible');
    }
   
    const precio = document.getElementById('editProdPrecio');
    const errorPrecio = document.getElementById('errorEditProdPrecio');
    const precioValor = parseFloat(precio.value);
    if (!precio.value || isNaN(precioValor) || precioValor <= 0) {
        precio.classList.add('invalido');
        errorPrecio.textContent = '⚠️ El precio debe ser mayor a 0';
        errorPrecio.classList.add('visible');
        valido = false;
    } else if (precioValor > LIMITES.precioMax) {
        precio.classList.add('invalido');
        errorPrecio.textContent = `⚠️ Máximo Bs ${LIMITES.precioMax.toFixed(2)}`;
        errorPrecio.classList.add('visible');
        valido = false;
    } else {
        precio.classList.remove('invalido');
        errorPrecio.classList.remove('visible');
    }

    // validar stock a agregar
    const stockAgregar = document.getElementById('editProdStockAgregar');
    if (stockAgregar && stockAgregar.value) {
        const valorAgregar = parseInt(stockAgregar.value);
        const stockActual = parseInt(document.getElementById('editProdStockActual').textContent) || 0;
        if (valorAgregar + stockActual > LIMITES.stockMax) {
            alert(`⚠️ El stock total no puede superar ${LIMITES.stockMax} unidades`);
            valido = false;
        }
    }
   
    return valido;
}
 
function validarFormEditarEspacio() {
    let valido = true;
   
    const nombre = document.getElementById('editEspNombre');
    const errorNombre = document.getElementById('errorEditEspNombre');
    if (!nombre.value.trim()) {
        nombre.classList.add('invalido');
        errorNombre.textContent = '⚠️ El nombre es obligatorio';
        errorNombre.classList.add('visible');
        valido = false;
    } else {
        nombre.classList.remove('invalido');
        errorNombre.classList.remove('visible');
    }

    const capacidad = document.getElementById('editEspCapacidad');
    const errorCapacidad = document.getElementById('errorEditEspCapacidad');
    if (capacidad && capacidad.value) {
        const valorCap = parseInt(capacidad.value);
        if (valorCap > LIMITES.capacidadMax) {
            capacidad.classList.add('invalido');
            if (errorCapacidad) {
                errorCapacidad.textContent = `⚠️ Máximo ${LIMITES.capacidadMax} personas`;
                errorCapacidad.classList.add('visible');
            }
            valido = false;
        } else if (valorCap <= 0) {
            capacidad.classList.add('invalido');
            if (errorCapacidad) {
                errorCapacidad.textContent = '⚠️ Debe ser mayor a 0';
                errorCapacidad.classList.add('visible');
            }
            valido = false;
        } else {
            capacidad.classList.remove('invalido');
            if (errorCapacidad) errorCapacidad.classList.remove('visible');
        }
    }
   
    return valido;
}

function renderizarProductos() {
    const tbody = document.getElementById('tbodyProductos');
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    const categoriaFiltro = document.getElementById('filtroCategoriaProd').value;
 
    let productosFiltrados = [...productosCache];
 
    if (busqueda) {
        productosFiltrados = productosFiltrados.filter(p =>
            p.name.toLowerCase().includes(busqueda) ||
            (p.description && p.description.toLowerCase().includes(busqueda))
        );
    }
 
    if (categoriaFiltro) {
        productosFiltrados = productosFiltrados.filter(p =>
            p.category_id == categoriaFiltro
        );
    }
 
    tbody.innerHTML = '';
 
    if (productosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#9ca3af;">No se encontraron productos</td></tr>';
        return;
    }
 
    productosFiltrados.forEach(producto => {
        const categoria = categoriasCache.find(c => c.id === producto.category_id);
        const esAdmin = USER_DATA.role?.name === 'Administrador';
       
        let claseStock = 'stock-alto';
        let estadoStockTexto = 'Normal';
        let claseEstadoStock = 'estado-pagado';
       
        if (producto.current_stock <= producto.minimum_stock) {
            claseStock = 'stock-bajo';
            estadoStockTexto = 'Stock Bajo';
            claseEstadoStock = 'estado-pendiente';
        } else if (producto.current_stock <= producto.minimum_stock * 2) {
            claseStock = 'stock-medio';
        }
 
        const estaActivo = producto.is_active === 1 || producto.is_active === true;
        const estadoActivoTexto = estaActivo ? 'Activo' : 'Inactivo';
        const claseEstadoActivo = estaActivo ? 'estado-activo' : 'estado-inactivo';
 
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${producto.name}</strong><br>
                <small style="color:#9ca3af">${producto.description || ''}</small>
            </td>
            <td>${categoria?.name || 'Sin categoría'}</td>
            <td>Bs ${parseFloat(producto.sale_price).toFixed(2)}</td>
            <td class="${claseStock}">${producto.current_stock}</td>
            <td>${producto.minimum_stock}</td>
            <td><span class="${claseEstadoStock}">${estadoStockTexto}</span></td>
            <td><span class="${claseEstadoActivo}">${estadoActivoTexto}</span></td>
            <td class="acciones">
                <button class="btn-accion btn-ver" onclick="verProducto(${producto.id})" title="Ver detalle">
                    <i class="fa-solid fa-eye"></i> Ver
                </button>
                ${esAdmin ? `
                    <button class="btn-accion btn-editar" onclick="editarProducto(${producto.id})" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}
 
function renderizarEspacios() {
    const tbody = document.getElementById('tbodyEspacios');
    const busqueda = document.getElementById('buscarEspacio').value.toLowerCase();
    const tipoFiltro = document.getElementById('filtroTipoEspacio').value;
 
    let espaciosFiltrados = [...espaciosCache];
 
    if (busqueda) {
        espaciosFiltrados = espaciosFiltrados.filter(e =>
            e.name.toLowerCase().includes(busqueda)
        );
    }
 
    if (tipoFiltro) {
        espaciosFiltrados = espaciosFiltrados.filter(e =>
            e.space_type_id == tipoFiltro
        );
    }
 
    tbody.innerHTML = '';
 
    if (espaciosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#9ca3af;">No se encontraron espacios</td></tr>';
        return;
    }
 
    espaciosFiltrados.forEach(espacio => {
        const tipo = tiposEspacioCache.find(t => t.id === espacio.space_type_id);
        const esAdmin = USER_DATA.role?.name === 'Administrador';
       
        const ordenActiva = ordenesCache.find(o =>
            o.space_id === espacio.id && (o.order_status_id === 1 || o.order_status_id === 3)
        );
       
        let icono = '';
        if (tipo?.name === 'Cuarto') {
            icono = '<i class="fa-solid fa-door-open" style="color:#7c3aed;margin-right:6px"></i>';
        } else if (tipo?.name === 'Mesa') {
            icono = '<i class="fa-solid fa-table" style="color:#059669;margin-right:6px"></i>';
        } else if (tipo?.name === 'Barra') {
            icono = '<i class="fa-solid fa-martini-glass" style="color:#d97706;margin-right:6px"></i>';
        }
 
        const estaActivo = espacio.is_active === 1 || espacio.is_active === true;
        const estadoActivoTexto = estaActivo ? 'Activo' : 'Inactivo';
        const claseEstadoActivo = estaActivo ? 'estado-activo' : 'estado-inactivo';
 
        const precioHora = espacio.hourly_rent_price > 0
            ? `Bs ${parseFloat(espacio.hourly_rent_price).toFixed(2)}`
            : '—';
 
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${icono}<strong>${espacio.name}</strong></td>
            <td>${tipo?.name || 'N/A'}</td>
            <td>${espacio.capacity || '—'} personas</td>
            <td>${precioHora}</td>
            <td><span class="${claseEstadoActivo}">${estadoActivoTexto}</span></td>
            <td class="acciones">
                <button class="btn-accion btn-ver" onclick="verEspacio(${espacio.id})" title="Ver detalle">
                    <i class="fa-solid fa-eye"></i> Ver
                </button>
                ${esAdmin ? `
                    <button class="btn-accion btn-editar" onclick="editarEspacio(${espacio.id})" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}
 
function actualizarEstadisticas() {
    try {
        const productosActivos = productosCache.filter(p => 
            p.is_active === true || p.is_active === 1
        );
        
        const stockBajo = productosActivos.filter(p => 
            p.current_stock <= p.minimum_stock
        );
        
        const espaciosActivos = espaciosCache.filter(e => 
            e.is_active === true || e.is_active === 1
        );
       
        const hoy = new Date();
        const diaHoy = hoy.getDate();
        const mesHoy = hoy.getMonth();
        const anioHoy = hoy.getFullYear();
         
        const movimientosHoy = movimientosCache.filter(m => {
            if (!m.created_at) return false;
            const fechaMov = new Date(m.created_at);
            return fechaMov.getDate() === diaHoy &&
                   fechaMov.getMonth() === mesHoy &&
                   fechaMov.getFullYear() === anioHoy;
        });

        const statProductos = document.getElementById('statProductos');
        const statStockBajo = document.getElementById('statStockBajo');
        const statEspacios = document.getElementById('statEspacios');
        const statMovimientos = document.getElementById('statMovimientos');

        if (statProductos) statProductos.textContent = productosActivos.length;
        if (statStockBajo) statStockBajo.textContent = stockBajo.length;
        if (statEspacios) statEspacios.textContent = espaciosActivos.length;
        if (statMovimientos) statMovimientos.textContent = movimientosHoy.length;

    } catch (error) {
        console.error('error al actualizar estadisticas:', error);
    }
}
 
function configurarModales() {
    document.querySelectorAll('.modal-inventario').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
 
    document.getElementById('nuevoEspTipo').addEventListener('change', function() {
        const grupo = document.getElementById('nuevoGrupoPrecioHora');
        grupo.style.opacity = this.value == '1' ? '1' : '0.4';
    });
 
    document.getElementById('editEspTipo').addEventListener('change', function() {
        const grupo = document.getElementById('editGrupoPrecioHora');
        grupo.style.opacity = this.value == '1' ? '1' : '0.4';
    });
}
 
function abrirModal(id) {
    document.getElementById(id).style.display = 'flex';
}
 
function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

async function verProducto(productoId) {
    try {
        const producto = productosCache.find(p => p.id === productoId);
        if (!producto) return;
 
        document.getElementById('verProdNombre').textContent = producto.name;
       
        const categoria = categoriasCache.find(c => c.id === producto.category_id);
        document.getElementById('verProdCategoria').textContent = categoria?.name || 'Sin categoría';
       
        const unidad = unidadesCache.find(u => u.id === producto.measure_unit_id);
        document.getElementById('verProdUnidad').textContent = unidad?.name || 'N/A';
       
        document.getElementById('verProdPrecio').textContent = `Bs ${parseFloat(producto.sale_price).toFixed(2)}`;
        document.getElementById('verProdCosto').textContent = producto.cost ? `Bs ${parseFloat(producto.cost).toFixed(2)}` : 'No definido';
        document.getElementById('verProdStock').textContent = producto.current_stock;
        document.getElementById('verProdMinimo').textContent = producto.minimum_stock;
 
        let estadoTexto = 'Normal';
        let claseEstado = 'estado-pagado';
        if (producto.current_stock <= producto.minimum_stock) {
            estadoTexto = 'Stock Bajo';
            claseEstado = 'estado-pendiente';
        }
        document.getElementById('verProdEstado').innerHTML = `<span class="${claseEstado}">${estadoTexto}</span>`;
 
        if (producto.description) {
            document.getElementById('verProdDescripcionContainer').style.display = 'block';
            document.getElementById('verProdDescripcion').textContent = producto.description;
        } else {
            document.getElementById('verProdDescripcionContainer').style.display = 'none';
        }
 
        const movimientosProd = movimientosCache
            .filter(m => m.product_id === productoId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
 
        const tbodyMov = document.getElementById('verProdMovimientos');
        tbodyMov.innerHTML = '';
 
        if (movimientosProd.length === 0) {
            tbodyMov.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#9ca3af;">Sin movimientos registrados</td></tr>';
        } else {
            movimientosProd.forEach(mov => {
                const tipoMov = mov.movement_type?.name || 'N/A';
                const usuario = mov.user ? `${mov.user.first_name} ${mov.user.last_name || ''}` : 'Sistema';
                const fecha = new Date(mov.created_at).toLocaleString('es-BO');
               
                let claseCantidad = '';
                if (mov.quantity > 0) claseCantidad = 'stock-alto';
                else if (mov.quantity < 0) claseCantidad = 'stock-bajo';
 
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${fecha}</td>
                    <td>${tipoMov}</td>
                    <td class="${claseCantidad}">${mov.quantity > 0 ? '+' : ''}${mov.quantity}</td>
                    <td>${mov.previous_stock}</td>
                    <td>${mov.new_stock}</td>
                    <td>${usuario}</td>
                `;
                tbodyMov.appendChild(tr);
            });
        }
 
        abrirModal('modalVerProducto');
 
    } catch (error) {
        console.error('Error al ver producto:', error);
        alert('Error al cargar el detalle del producto');
    }
}
 
function verEspacio(espacioId) {
    try {
        const espacio = espaciosCache.find(e => e.id === espacioId);
        if (!espacio) return;
 
        const tipo = tiposEspacioCache.find(t => t.id === espacio.space_type_id);
       
        document.getElementById('verEspNombre').textContent = espacio.name;
        document.getElementById('verEspTipo').textContent = tipo?.name || 'N/A';
        document.getElementById('verEspCapacidad').textContent = `${espacio.capacity || '—'} personas`;
        document.getElementById('verEspPrecio').textContent = espacio.hourly_rent_price > 0
            ? `Bs ${parseFloat(espacio.hourly_rent_price).toFixed(2)}/hora`
            : 'No aplica';
 
        const estaActivo = espacio.is_active === 1 || espacio.is_active === true;
        const estadoTexto = estaActivo ? 'Activo' : 'Inactivo';
        const claseEstado = estaActivo ? 'estado-activo' : 'estado-inactivo';
        document.getElementById('verEspEstado').innerHTML = `<span class="${claseEstado}">${estadoTexto}</span>`;
 
        const ordenesEspacio = ordenesCache
            .filter(o => o.space_id === espacioId)
            .sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at))
            .slice(0, 10);
 
        const tbodyHist = document.getElementById('verEspHistorial');
        tbodyHist.innerHTML = '';
 
        if (ordenesEspacio.length === 0) {
            tbodyHist.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#9ca3af;">Sin órdenes registradas</td></tr>';
        } else {
            ordenesEspacio.forEach(orden => {
                const fecha = new Date(orden.opened_at).toLocaleDateString('es-BO');
                let estadoNombre = 'Pendiente';
                let claseEstado = 'estado-pendiente';
               
                if (orden.order_status_id === 2) {
                    estadoNombre = 'Pagado';
                    claseEstado = 'estado-pagado';
                } else if (orden.order_status_id === 3) {
                    estadoNombre = 'Parcial';
                    claseEstado = 'estado-parcial';
                }
 
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${orden.folio}</strong></td>
                    <td>${fecha}</td>
                    <td>${orden.number_of_people}</td>
                    <td>Bs ${parseFloat(orden.total_amount || 0).toFixed(2)}</td>
                    <td><span class="${claseEstado}">${estadoNombre}</span></td>
                `;
                tbodyHist.appendChild(tr);
            });
        }
 
        abrirModal('modalVerEspacio');
 
    } catch (error) {
        console.error('Error al ver espacio:', error);
        alert('Error al cargar el detalle del espacio');
    }
}
 

function abrirNuevoProducto() {
    document.getElementById('formNuevoProducto').reset();
    abrirModal('modalNuevoProducto');
}
 
function abrirNuevoEspacio() {
    document.getElementById('formNuevoEspacio').reset();
    document.getElementById('nuevoGrupoPrecioHora').style.opacity = '0.4';
    abrirModal('modalNuevoEspacio');
}
 
function editarProducto(productoId) {
    const producto = productosCache.find(p => p.id === productoId);
    if (!producto) return;
 
    document.getElementById('editProdId').value = producto.id;
    document.getElementById('editProdNombre').value = producto.name;
    document.getElementById('editProdCategoria').value = producto.category_id || '';
    document.getElementById('editProdUnidad').value = producto.measure_unit_id;
    document.getElementById('editProdPrecio').value = producto.sale_price;
    document.getElementById('editProdCosto').value = producto.cost || '';
    document.getElementById('editProdMinimo').value = producto.minimum_stock;
    document.getElementById('editProdActivo').checked = producto.is_active === 1 || producto.is_active === true;
    document.getElementById('editProdDescripcion').value = producto.description || '';
    
    const stockActualEl = document.getElementById('editProdStockActual');
    const stockAgregarEl = document.getElementById('editProdStockAgregar');
    const stockNuevoEl = document.getElementById('editProdStockNuevo');
    
    if (stockActualEl) stockActualEl.textContent = producto.current_stock;
    if (stockAgregarEl) stockAgregarEl.value = 0;
    if (stockNuevoEl) stockNuevoEl.textContent = producto.current_stock;
 
    abrirModal('modalEditarProducto');
}
 
function editarEspacio(espacioId) {
    const espacio = espaciosCache.find(e => e.id === espacioId);
    if (!espacio) return;
 
    document.getElementById('editEspId').value = espacio.id;
    document.getElementById('editEspNombre').value = espacio.name;
    document.getElementById('editEspTipo').value = espacio.space_type_id;
    document.getElementById('editEspCapacidad').value = espacio.capacity || '';
    document.getElementById('editEspPrecioHora').value = espacio.hourly_rent_price || 0;
    document.getElementById('editEspActivo').checked = espacio.is_active === 1 || espacio.is_active === true;
   
    document.getElementById('editGrupoPrecioHora').style.opacity =
        espacio.space_type_id == 1 ? '1' : '0.4';
 
    abrirModal('modalEditarEspacio');
}
 

function configurarFormularios() {
    // NUEVO PRODUCTO
    document.getElementById('formNuevoProducto').addEventListener('submit', async (e) => {
        e.preventDefault();
 
        if (!validarFormNuevoProducto()) {
            return;
        }
 
        const data = {
            name: document.getElementById('nuevoProdNombre').value,
            category_id: parseInt(document.getElementById('nuevoProdCategoria').value) || null,
            measure_unit_id: parseInt(document.getElementById('nuevoProdUnidad').value),
            sale_price: parseFloat(document.getElementById('nuevoProdPrecio').value),
            cost: parseFloat(document.getElementById('nuevoProdCosto').value) || null,
            current_stock: parseInt(document.getElementById('nuevoProdStock').value) || 0,
            minimum_stock: parseInt(document.getElementById('nuevoProdMinimo').value) || 5,
            is_active: true,
            description: document.getElementById('nuevoProdDescripcion').value || null
        };
 
        try {
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
 
            if (response.ok) {
                alert('Producto creado correctamente');
                cerrarModal('modalNuevoProducto');
                await cargarDatosBase();
                renderizarProductos();
                actualizarEstadisticas();
            } else {
                const error = await response.json();
                const mensaje = error.message || Object.values(error.errors || {}).flat().join(', ');
                alert('Error: ' + mensaje);
            }
        } catch (error) {
            console.error('Error al crear producto:', error);
            alert('Error al crear el producto');
        }
    });
 
    document.getElementById('formEditarProducto').addEventListener('submit', async (e) => {
        e.preventDefault();
 
        if (!validarFormEditarProducto()) {
            return;
        }
 
        const id = document.getElementById('editProdId').value;
        
        const stockAgregar = parseInt(document.getElementById('editProdStockAgregar').value) || 0;
        const stockActual = parseInt(document.getElementById('editProdStockActual').textContent) || 0;
        const nuevoStockTotal = stockActual + stockAgregar;
        
        const data = {
            name: document.getElementById('editProdNombre').value,
            category_id: parseInt(document.getElementById('editProdCategoria').value) || null,
            measure_unit_id: parseInt(document.getElementById('editProdUnidad').value),
            sale_price: parseFloat(document.getElementById('editProdPrecio').value),
            cost: parseFloat(document.getElementById('editProdCosto').value) || null,
            current_stock: nuevoStockTotal, 
            minimum_stock: parseInt(document.getElementById('editProdMinimo').value) || 5,
            is_active: document.getElementById('editProdActivo').checked,
            description: document.getElementById('editProdDescripcion').value || null
        };
 
        try {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
 
            if (response.ok) {
                let mensaje = 'Producto actualizado correctamente';
                if (stockAgregar > 0) {
                    mensaje += `\n\n📦 Stock aumentado:\n   Anterior: ${stockActual}\n   Agregado: +${stockAgregar}\n   Nuevo total: ${nuevoStockTotal}`;
                }
                alert(mensaje);
                cerrarModal('modalEditarProducto');
                await cargarDatosBase();
                renderizarProductos();
                actualizarEstadisticas();
            } else {
                const error = await response.json();
                const mensaje = error.message || Object.values(error.errors || {}).flat().join(', ');
                alert('Error: ' + mensaje);
            }
        } catch (error) {
            console.error('Error al actualizar producto:', error);
            alert('Error al actualizar el producto');
        }
    });
 
    // NUEVO ESPACIO
    document.getElementById('formNuevoEspacio').addEventListener('submit', async (e) => {
        e.preventDefault();
 
        if (!validarFormNuevoEspacio()) {
            return;
        }
 
        const data = {
            name: document.getElementById('nuevoEspNombre').value,
            space_type_id: parseInt(document.getElementById('nuevoEspTipo').value),
            capacity: parseInt(document.getElementById('nuevoEspCapacidad').value) || null,
            hourly_rent_price: parseFloat(document.getElementById('nuevoEspPrecioHora').value) || 0,
            is_active: true
        };
 
        try {
            const response = await fetch(`${API_BASE_URL}/spaces`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
 
            if (response.ok) {
                alert('Espacio creado correctamente');
                cerrarModal('modalNuevoEspacio');
                await cargarDatosBase();
                renderizarEspacios();
                actualizarEstadisticas();
            } else {
                const error = await response.json();
                const mensaje = error.message || Object.values(error.errors || {}).flat().join(', ');
                alert('Error: ' + mensaje);
            }
        } catch (error) {
            console.error('Error al crear espacio:', error);
            alert('Error al crear el espacio');
        }
    });
 
    // EDITAR ESPACIO
    document.getElementById('formEditarEspacio').addEventListener('submit', async (e) => {
        e.preventDefault();
 
        if (!validarFormEditarEspacio()) {
            return;
        }
 
        const id = document.getElementById('editEspId').value;
        const data = {
            name: document.getElementById('editEspNombre').value,
            space_type_id: parseInt(document.getElementById('editEspTipo').value),
            capacity: parseInt(document.getElementById('editEspCapacidad').value) || null,
            hourly_rent_price: parseFloat(document.getElementById('editEspPrecioHora').value) || 0,
            is_active: document.getElementById('editEspActivo').checked
        };
 
        try {
            const response = await fetch(`${API_BASE_URL}/spaces/${id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
 
            if (response.ok) {
                alert('Espacio actualizado correctamente');
                cerrarModal('modalEditarEspacio');
                await cargarDatosBase();
                await cargarOrdenes();
                renderizarEspacios();
                actualizarEstadisticas();
            } else {
                const error = await response.json();
                const mensaje = error.message || Object.values(error.errors || {}).flat().join(', ');
                alert('Error: ' + mensaje);
            }
        } catch (error) {
            console.error('Error al actualizar espacio:', error);
            alert('Error al actualizar el espacio');
        }
    });
}