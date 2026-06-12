const API_BASE_URL = 'http://localhost:8000/api';
let TOKEN = localStorage.getItem('token');
let USER_DATA = JSON.parse(localStorage.getItem('usuario') || '{}');

let ordenCreada = null;
let itemsOrden = [];
let productos = [];
let espacios = [];
let categorias = [];
let unidades = [];
let ordenesActivas = [];
let categoriaSeleccionada = 'todas';

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
    };
}

if (!TOKEN) {
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!TOKEN) return;

    document.getElementById('nombreUsuario').textContent = `${USER_DATA.first_name} ${USER_DATA.last_name || ''}`;
    document.getElementById('badgeRol').textContent = USER_DATA.role?.name || 'Empleado';

    controlarRoles();
    await cargarDatosIniciales();
    configurarEventos();
});

function controlarRoles() {
    const esAdmin = USER_DATA.role?.name === 'Administrador';
    document.querySelectorAll('[data-rol="admin"]').forEach(el => {
        if (!esAdmin) el.style.display = 'none';
    });
}

async function cargarDatosIniciales() {
    try {
        const [espaciosRes, productosRes, categoriasRes, unidadesRes, ordenesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/spaces`, { headers: getHeaders() }),
            fetch(`${API_BASE_URL}/products`, { headers: getHeaders() }),
            fetch(`${API_BASE_URL}/product-categories`, { headers: getHeaders() }),
            fetch(`${API_BASE_URL}/measure-units`, { headers: getHeaders() }),
            fetch(`${API_BASE_URL}/orders`, { headers: getHeaders() })
        ]);

        espacios = await espaciosRes.json();
        productos = await productosRes.json();
        categorias = await categoriasRes.json();
        unidades = await unidadesRes.json();
        ordenesActivas = await ordenesRes.json();

        console.log('productos:', productos.length);
        console.log('categorias:', categorias.length);
        console.log('ordenes activas:', ordenesActivas.length);

        llenarSelectEspacios();
        cargarBotonesCategorias();
        mostrarCatalogoProductos();

        console.log('datos iniciales cargados correctamente');

    } catch (error) {
        console.error('error al cargar datos:', error);
        alert('error al cargar los datos. verifica tu conexion.');
    }
}

function llenarSelectEspacios() {
    const select = document.getElementById('espacio');
    select.innerHTML = '<option value="">seleccionar espacio</option>';

    const espaciosOcupados = ordenesActivas
        .filter(o => o.order_status_id === 1 || o.order_status_id === 3)
        .map(o => o.space_id);

    const espaciosDisponibles = espacios.filter(e => e.is_active);

    console.log('espacios activos:', espaciosDisponibles.length);
    console.log('espacios ocupados:', espaciosOcupados);

    espaciosDisponibles.forEach(espacio => {
        const tipoNombre = espacio.space_type?.name || 'N/A';
        const estaOcupado = espaciosOcupados.includes(espacio.id);
        
        const option = document.createElement('option');
        option.value = espacio.id;
        
        if (estaOcupado) {
            option.textContent = `${espacio.name} (${tipoNombre}) - OCUPADO`;
            option.disabled = true;
            option.style.color = '#9ca3af';
        } else {
            option.textContent = `${espacio.name} (${tipoNombre})`;
        }
        
        select.appendChild(option);
    });
}

function actualizarLimitePersonas() {
    const espacioId = document.getElementById('espacio').value;
    const inputPersonas = document.getElementById('inputPersonas');
    
    if (!inputPersonas) return;
    
    if (!espacioId) {
        inputPersonas.removeAttribute('max');
        inputPersonas.placeholder = 'Cantidad de personas';
        return;
    }
    
    const espacio = espacios.find(e => e.id == espacioId);
    
    if (espacio && espacio.capacity) {
        inputPersonas.max = espacio.capacity;
        inputPersonas.placeholder = `maximo ${espacio.capacity} personas`;
        
        if (parseInt(inputPersonas.value) > espacio.capacity) {
            inputPersonas.value = espacio.capacity;
        }
    } else {
        inputPersonas.removeAttribute('max');
        inputPersonas.placeholder = 'Cantidad de personas';
    }
}

function cargarBotonesCategorias() {
    const contenedor = document.getElementById('categoriasContainer');
    if (!contenedor) return;
    
    contenedor.innerHTML = `
        <button class="btn-categoria activo" data-categoria="todas">
            <i class="fa-solid fa-border-all"></i>
            todas
            <span class="contador">${productos.length}</span>
        </button>
    `;

    categorias.forEach(categoria => {
        const cantidad = productos.filter(p => p.category_id === categoria.id && p.is_active).length;
        
        if (cantidad > 0) {
            const btn = document.createElement('button');
            btn.className = 'btn-categoria';
            btn.dataset.categoria = categoria.id;
            
            let icono = 'fa-box';
            const nombre = categoria.name.toLowerCase();
            if (nombre.includes('cerveza')) icono = 'fa-beer-mug-empty';
            else if (nombre.includes('whisky')) icono = 'fa-whiskey-glass';
            else if (nombre.includes('vodka')) icono = 'fa-glass-water';
            else if (nombre.includes('ron')) icono = 'fa-wine-glass';
            else if (nombre.includes('tequila')) icono = 'fa-martini-glass';
            
            btn.innerHTML = `
                <i class="fa-solid ${icono}"></i>
                ${categoria.name}
                <span class="contador">${cantidad}</span>
            `;
            
            contenedor.appendChild(btn);
        }
    });

    contenedor.querySelectorAll('.btn-categoria').forEach(btn => {
        btn.addEventListener('click', () => {
            contenedor.querySelectorAll('.btn-categoria').forEach(b => 
                b.classList.remove('activo')
            );
            
            btn.classList.add('activo');
            categoriaSeleccionada = btn.dataset.categoria;
            
            const buscador = document.getElementById('buscarProducto');
            if (buscador) buscador.value = '';
            
            mostrarCatalogoProductos();
        });
    });
}

function mostrarCatalogoProductos(productosFiltrados = null) {
    const grid = document.getElementById('gridProductos');
    if (!grid) return;
    
    grid.innerHTML = '';

    // ✅ FILTRAR SOLO PRODUCTOS ACTIVOS
    let listaProductos = (productosFiltrados || productos).filter(p => p.is_active);
    
    if (categoriaSeleccionada !== 'todas') {
        listaProductos = listaProductos.filter(p => 
            p.category_id == categoriaSeleccionada
        );
    }

    if (listaProductos.length === 0) {
        grid.innerHTML = `
            <div class="sin-productos">
                <i class="fa-solid fa-box-open"></i>
                <p>no hay productos en esta categoria</p>
                <small>intenta con otra categoria</small>
            </div>
        `;
        return;
    }

    listaProductos.forEach(producto => {
        const categoria = categorias.find(c => c.id === producto.category_id);
        const unidad = unidades.find(u => u.id === producto.measure_unit_id);
        const unidadNombre = unidad ? unidad.name : '';
        const icono = obtenerIconoCategoria(categoria?.name);
        const claseIcono = obtenerClaseCategoria(categoria?.name);

        const card = document.createElement('div');
        card.className = 'card-producto';
        card.innerHTML = `
            <div class="icono-producto ${claseIcono}">
                <i class="${icono}"></i>
            </div>
            <h3>${producto.name}</h3>
            <p>stock: ${producto.current_stock} ${unidadNombre}</p>
            <span class="precio">Bs ${parseFloat(producto.sale_price).toFixed(2)}</span>
            <button class="btn-agregar" 
                    onclick="agregarProducto(${producto.id})"
                    ${producto.current_stock <= 0 ? 'disabled' : ''}>
                <i class="fa-solid fa-plus"></i>
                ${producto.current_stock <= 0 ? 'sin stock' : 'agregar'}
            </button>
        `;
        grid.appendChild(card);
    });
}

function obtenerIconoCategoria(nombreCategoria) {
    if (!nombreCategoria) return 'fa-solid fa-wine-bottle';
    const nombre = nombreCategoria.toLowerCase();
    if (nombre.includes('cerveza')) return 'fa-solid fa-beer-mug-empty';
    if (nombre.includes('whisky')) return 'fa-solid fa-whiskey-glass';
    if (nombre.includes('vodka')) return 'fa-solid fa-glass-water';
    if (nombre.includes('ron')) return 'fa-solid fa-wine-glass';
    if (nombre.includes('tequila')) return 'fa-solid fa-martini-glass';
    return 'fa-solid fa-wine-bottle';
}

function obtenerClaseCategoria(nombreCategoria) {
    if (!nombreCategoria) return 'coctel';
    const nombre = nombreCategoria.toLowerCase();
    if (nombre.includes('cerveza')) return 'cerveza';
    if (nombre.includes('whisky')) return 'whisky';
    if (nombre.includes('vodka')) return 'vodka';
    if (nombre.includes('ron')) return 'ron';
    if (nombre.includes('tequila')) return 'tequila';
    return 'coctel';
}

function configurarEventos() {
    document.getElementById('buscarProducto').addEventListener('input', (e) => {
        const busqueda = e.target.value.toLowerCase();
        
        if (busqueda.length > 0) {
            const filtrados = productos.filter(p => 
                p.name.toLowerCase().includes(busqueda) ||
                p.description?.toLowerCase().includes(busqueda)
            );
            mostrarCatalogoProductos(filtrados);
        } else {
            mostrarCatalogoProductos();
        }
    });

    document.getElementById('btnCancelar').addEventListener('click', () => {
        if (itemsOrden.length > 0) {
            if (!confirm('estas seguro de cancelar?')) return;
        }
        window.location.href = 'ordenes.html';
    });

    document.getElementById('btnGuardar').addEventListener('click', () => {
        guardarOrden(true);
    });

    document.getElementById('btnPagar').addEventListener('click', () => {
        guardarOrden(false);
    });

    document.getElementById('formPago').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!ordenCreadaParaPago) {
            alert('error: no hay orden activa');
            return;
        }

        const monto = parseFloat(document.getElementById('pagoMonto').value);
        const metodoId = parseInt(document.getElementById('pagoMetodo').value);
        const tipoId = parseInt(document.getElementById('pagoTipo').value);
        const referencia = document.getElementById('pagoReferencia').value;
        const notas = document.getElementById('pagoNotas').value;

        if (!monto || monto <= 0) {
            alert('ingrese un monto valido');
            return;
        }

        if (!metodoId) {
            alert('seleccione un metodo de pago');
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/orders/${ordenCreadaParaPago.id}/payments`, 
                {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        amount: monto,
                        payment_method_id: metodoId,
                        payment_type_id: tipoId,
                        reference: referencia || null,
                        notes: notas || null
                    })
                }
            );

            if (response.ok) {
                alert('orden creada y pago registrado exitosamente!');
                cerrarModalPago();
                window.location.href = 'ordenes.html';
            } else {
                const error = await response.json();
                alert(error.message || 'error al registrar el pago');
            }
        } catch (error) {
            console.error('error al registrar pago:', error);
            alert('error al registrar el pago');
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
                console.error('error al cerrar sesion:', error);
            } finally {
                localStorage.removeItem('token');
                localStorage.removeItem('usuario');
                window.location.href = 'index.html';
            }
        });
    }

    document.getElementById('modalPago').addEventListener('click', (e) => {
        if (e.target.id === 'modalPago') {
            cerrarModalPago();
        }
    });

    document.getElementById('espacio')?.addEventListener('change', () => {
        actualizarResumen();
        actualizarLimitePersonas();
    });
}

function agregarProducto(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    //VALIDAR QUE EL PRODUCTO ESTE ACTIVO
    if (!producto.is_active) {
        alert('este producto no esta disponible');
        return;
    }

    // VALIDAR QUE TENGA STOCK
    if (producto.current_stock <= 0) {
        alert(`el producto "${producto.name}" no tiene stock disponible`);
        return;
    }

    const itemExistente = itemsOrden.find(i => i.product_id === productoId);

    if (itemExistente) {
        if (itemExistente.quantity >= producto.current_stock) {
            alert(`stock maximo: ${producto.current_stock}`);
            return;
        }
        itemExistente.quantity++;
        itemExistente.subtotal = itemExistente.quantity * itemExistente.unit_price;
        itemExistente.total = itemExistente.subtotal;
    } else {
        itemsOrden.push({
            product_id: producto.id,
            product_name: producto.name,
            quantity: 1,
            unit_price: parseFloat(producto.sale_price),
            subtotal: parseFloat(producto.sale_price),
            total: parseFloat(producto.sale_price),
            stock_disponible: producto.current_stock
        });
    }

    actualizarTablaDetalle();
    actualizarResumen();
}

function actualizarTablaDetalle() {
    const tbody = document.getElementById('detalleOrden');
    tbody.innerHTML = '';

    if (itemsOrden.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:20px; color:#888;">
                    no hay productos agregados
                </td>
            </tr>
        `;
        return;
    }

    itemsOrden.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.product_name}</td>
            <td>
                <input type="number" 
                       min="1" 
                       max="${item.stock_disponible}" 
                       value="${item.quantity}" 
                       class="input-cantidad"
                       onchange="actualizarCantidad(${index}, this.value)">
            </td>
            <td>Bs ${item.unit_price.toFixed(2)}</td>
            <td>Bs ${item.subtotal.toFixed(2)}</td>
            <td>
                <button class="btn-eliminar" onclick="eliminarItem(${index})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function actualizarCantidad(index, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad);
    const item = itemsOrden[index];

    if (isNaN(cantidad) || cantidad < 1) {
        alert('cantidad invalida');
        actualizarTablaDetalle();
        return;
    }

    if (cantidad > item.stock_disponible) {
        alert(`stock maximo: ${item.stock_disponible}`);
        actualizarTablaDetalle();
        return;
    }

    item.quantity = cantidad;
    item.subtotal = item.quantity * item.unit_price;
    item.total = item.subtotal;

    actualizarTablaDetalle();
    actualizarResumen();
}

function eliminarItem(index) {
    itemsOrden.splice(index, 1);
    actualizarTablaDetalle();
    actualizarResumen();
}

function actualizarResumen() {
    const totalProductos = itemsOrden.reduce((sum, item) => sum + item.total, 0);
    const espacioId = document.getElementById('espacio').value;
    const espacio = espacios.find(e => e.id == espacioId);
    const costoEspacio = espacio ? parseFloat(espacio.hourly_rent_price || 0) : 0;
    const descuento = 0;
    const total = totalProductos + costoEspacio - descuento;

    const resumenItems = document.querySelectorAll('.resumen-item');
    
    if (resumenItems[0]) {
        resumenItems[0].querySelector('strong').textContent = `Bs ${totalProductos.toFixed(2)}`;
    }
    
    if (resumenItems[1]) {
        resumenItems[1].querySelector('strong').textContent = `Bs ${costoEspacio.toFixed(2)}`;
    }
    
    if (resumenItems[2]) {
        resumenItems[2].querySelector('strong').textContent = `Bs ${descuento.toFixed(2)}`;
    }
    
    const totalEl = document.querySelector('.resumen-total strong');
    if (totalEl) {
        totalEl.textContent = `Bs ${total.toFixed(2)}`;
    }
}

async function guardarOrden(soloGuardar = true) {
    console.log(' FUNCION guardarOrden EJECUTADA');
    console.log('soloGuardar:', soloGuardar);
    
    const espacioId = document.getElementById('espacio').value;
    if (!espacioId) {
        alert('por favor selecciona un espacio');
        return;
    }

    const espacio = espacios.find(e => e.id == espacioId);
    if (!espacio) {
        alert('el espacio seleccionado no existe');
        return;
    }
    
    if (!espacio.is_active) {
        alert('el espacio seleccionado ya no esta disponible. selecciona otro.');
        return;
    }
    
    const espaciosOcupados = ordenesActivas
        .filter(o => o.order_status_id === 1 || o.order_status_id === 3)
        .map(o => o.space_id);
    
    if (espaciosOcupados.includes(parseInt(espacioId))) {
        alert('este espacio ya tiene una orden activa. selecciona otro espacio.');
        return;
    }

    const inputPersonas = document.getElementById('inputPersonas');
    const personas = inputPersonas?.value;

    if (!personas || parseInt(personas) < 1) {
        alert('por favor ingresa la cantidad de personas');
        return;
    }

    if (espacio.capacity && parseInt(personas) > espacio.capacity) {
        alert(`la capacidad maxima de ${espacio.name} es de ${espacio.capacity} personas`);
        inputPersonas.value = espacio.capacity;
        return;
    }

    for (const item of itemsOrden) {
        const producto = productos.find(p => p.id === item.product_id);
        if (!producto || !producto.is_active) {
            alert(`el producto "${item.product_name}" ya no esta disponible. eliminalo de la orden.`);
            return;
        }
        if (producto.current_stock < item.quantity) {
            alert(`stock insuficiente para "${producto.name}". disponible: ${producto.current_stock}`);
            return;
        }
    }

    if (itemsOrden.length === 0) {
        if (!confirm('no has agregado productos. deseas crear la orden vacia?')) {
            return;
        }
    }

    // Obtener observaciones del textarea correcto
    const observaciones = document.querySelector('.grupo-campo textarea')?.value || '';

    const dataOrden = {
        space_id: parseInt(espacioId),
        number_of_people: parseInt(personas),
        notes: observaciones
    };

    console.log('Datos a enviar:', dataOrden);
    console.log('Headers:', getHeaders());

    try {
        console.log('Enviando POST a /orders...');
        
        const ordenResponse = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(dataOrden)
        });

        console.log('Status:', ordenResponse.status);
        console.log('Status Text:', ordenResponse.statusText);

        if (!ordenResponse.ok) {
            const errorText = await ordenResponse.text();
            console.error('Error response:', errorText);
            
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            
            throw new Error(errorData.message || `Error ${ordenResponse.status}: ${ordenResponse.statusText}`);
        }

        const orden = await ordenResponse.json();
        console.log('✅ Orden creada exitosamente:', orden);

        // Agregar items
        console.log(`Agregando ${itemsOrden.length} items...`);
        
        for (let i = 0; i < itemsOrden.length; i++) {
            const item = itemsOrden[i];
            console.log(`Enviando item ${i + 1}/${itemsOrden.length}:`, item);
            
            const itemResponse = await fetch(`${API_BASE_URL}/orders/${orden.id}/items`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    notes: null
                })
            });

            console.log(`Item ${i + 1} status:`, itemResponse.status);

            if (!itemResponse.ok) {
                const errorText = await itemResponse.text();
                console.error(`Error al agregar item ${i + 1}:`, errorText);
                
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { message: errorText };
                }
                
                alert(`error al agregar ${item.product_name}: ${errorData.message || 'Error desconocido'}`);
            } else {
                console.log(`✅ Item ${i + 1} agregado correctamente`);
            }
        }

        // Obtener orden completa
        console.log('Obteniendo orden completa...');
        const ordenCompletaRes = await fetch(`${API_BASE_URL}/orders/${orden.id}`, {
            headers: getHeaders()
        });
        
        if (!ordenCompletaRes.ok) {
            console.warn('No se pudo obtener la orden completa, usando datos básicos');
            if (soloGuardar) {
                alert(`orden ${orden.folio} creada exitosamente!`);
                window.location.href = 'ordenes.html';
            } else {
                abrirModalPago(orden);
            }
            return;
        }
        
        const ordenCompleta = await ordenCompletaRes.json();
        console.log('✅ Orden completa:', ordenCompleta);

        if (soloGuardar) {
            alert(`orden ${ordenCompleta.folio} creada exitosamente!`);
            window.location.href = 'ordenes.html';
        } else {
            abrirModalPago(ordenCompleta);
        }

    } catch (error) {
        console.error('❌ Error al guardar orden:', error);
        alert('error al guardar la orden: ' + error.message);
    }
}

let ordenCreadaParaPago = null;

function abrirModalPago(orden) {
    ordenCreadaParaPago = orden;
    
    const total = parseFloat(orden.total_amount || 0);
    
    document.getElementById('pagoFolio').textContent = orden.folio;
    document.getElementById('pagoTotal').textContent = `Bs ${total.toFixed(2)}`;
    document.getElementById('pagoPendiente').textContent = `Bs ${total.toFixed(2)}`;
    
    document.getElementById('formPago').reset();
    document.getElementById('pagoMonto').value = total.toFixed(2);
    document.getElementById('pagoMonto').max = total;
    document.getElementById('pagoTipo').value = '1';
    
    document.getElementById('modalPago').classList.add('activo');
    document.body.style.overflow = 'hidden';
}

function cerrarModalPago() {
    document.getElementById('modalPago').classList.remove('activo');
    document.body.style.overflow = '';
    ordenCreadaParaPago = null;
}