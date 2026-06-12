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
let usuariosCache = [];
try {
    USER_DATA = JSON.parse(localStorage.getItem('usuario') || '{}');
} catch (e) {
    console.error('Error al parsear usuario:', e);
}
if (!token) {
    window.location.href = "login.html";
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
        window.location.href = "login.html";
        return;
    }
    if (!respuesta.ok) {
        const errorData = await respuesta.json().catch(() => ({}));
        throw { status: respuesta.status, data: errorData };
    }
    return respuesta.json();
}
document.addEventListener('DOMContentLoaded', () => {
    configurarRol();
    configurarFiltros();
    configurarFormularios();
    configurarModales();
    configurarValidacionesPreventivas(); 
    cargarUsuarios();
});
/* ====================================
   VALIDACIONES PREVENTIVAS EN TIEMPO REAL
   ==================================== */
 
// ✅ SOLO LETRAS Y ESPACIOS (para nombre y apellido)
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
 
// ✅ SOLO LETRAS, NÚMEROS Y GUIÓN BAJO (para username)
function soloAlfanumerico(input) {
    input.addEventListener('input', function() {
        const valorLimpio = this.value.replace(/[^a-zA-Z0-9_]/g, '');
        if (this.value !== valorLimpio) {
            this.value = valorLimpio;
        }
    });
    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const textoPegado = (e.clipboardData || window.clipboardData).getData('text');
        const textoLimpio = textoPegado.replace(/[^a-zA-Z0-9_]/g, '');
        document.execCommand('insertText', false, textoLimpio);
    });
}
 
// ✅ VALIDAR EMAIL EN TIEMPO REAL
function validarEmailTiempoReal(input, errorId) {
    input.addEventListener('input', function() {
        const errorSpan = document.getElementById(errorId);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (this.value && !emailRegex.test(this.value)) {
            this.classList.add('input-error');
            this.classList.remove('input-valido');
            if (errorSpan) {
                errorSpan.textContent = '⚠️ ingresa un correo valido';
            }
        } else if (this.value) {
            this.classList.remove('input-error');
            this.classList.add('input-valido');
            if (errorSpan) errorSpan.textContent = '';
        } else {
            this.classList.remove('input-error', 'input-valido');
            if (errorSpan) errorSpan.textContent = '';
        }
    });
}
 
// ✅ VALIDAR CONTRASEÑA EN TIEMPO REAL
function validarPasswordTiempoReal(input, errorId) {
    input.addEventListener('input', function() {
        const errorSpan = document.getElementById(errorId);
        if (this.value && this.value.length < 6) {
            this.classList.add('input-error');
            this.classList.remove('input-valido');
            if (errorSpan) {
                errorSpan.textContent = '⚠️ minimo 6 caracteres';
            }
        } else if (this.value) {
            this.classList.remove('input-error');
            this.classList.add('input-valido');
            if (errorSpan) errorSpan.textContent = '';
        } else {
            this.classList.remove('input-error', 'input-valido');
            if (errorSpan) errorSpan.textContent = '';
        }
    });
}
 
// ✅ CONFIGURAR TODAS LAS VALIDACIONES PREVENTIVAS
function configurarValidacionesPreventivas() {
    // NUEVO USUARIO
    const nuevoNombre = document.getElementById('nuevoNombre');
    const nuevoApellido = document.getElementById('nuevoApellido');
    const nuevoUsername = document.getElementById('nuevoUsername');
    const nuevoEmail = document.getElementById('nuevoEmail');
    const nuevoPassword = document.getElementById('nuevoPassword');
    if (nuevoNombre) soloLetras(nuevoNombre);
    if (nuevoApellido) soloLetras(nuevoApellido);
    if (nuevoUsername) soloAlfanumerico(nuevoUsername);
    if (nuevoEmail) validarEmailTiempoReal(nuevoEmail, 'errorEmail');
    if (nuevoPassword) validarPasswordTiempoReal(nuevoPassword, 'errorPassword');
    // EDITAR USUARIO
    const editNombre = document.getElementById('editNombre');
    const editApellido = document.getElementById('editApellido');
    const editUsername = document.getElementById('editUsername');
    const editEmail = document.getElementById('editEmail');
    if (editNombre) soloLetras(editNombre);
    if (editApellido) soloLetras(editApellido);
    if (editUsername) soloAlfanumerico(editUsername);
    if (editEmail) validarEmailTiempoReal(editEmail, 'errorEditEmail');
    // CAMBIAR CONTRASEÑA
    const nuevaPassInput = document.getElementById('nuevaPassInput');
    const confirmPassInput = document.getElementById('confirmPassInput');
    if (nuevaPassInput) validarPasswordTiempoReal(nuevaPassInput, 'errorNuevaPass');
    if (confirmPassInput) validarPasswordTiempoReal(confirmPassInput, 'errorConfirmPass');
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

        if (IS_ADMIN) {
            document.body.classList.add('es-admin');
            console.log('Usuario es ADMIN - clase es-admin agregada');
        } else {
            document.body.classList.remove('es-admin');
            if (badgeRol) {
                badgeRol.textContent = "Empleado";
                badgeRol.classList.add("badge-empleado");
            }
            console.log(' Usuario es EMPLEADO - clase es-admin removida');
        }
 
    } catch (error) {
        console.error('Error al configurar rol:', error);
        // Si hay error, no remover la clase
    }
}

// Asegurar que se ejecute al cargar
document.addEventListener('DOMContentLoaded', () => {
    configurarRol();
    configurarFiltros();
    cargarUsuarios();
});
/* CARGAR USUARIOS */
async function cargarUsuarios() {
    try {
        usuariosCache = await apiCall('/users');
        renderizarUsuarios();
        actualizarEstadisticas();
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
    }
}
function renderizarUsuarios() {
    const tbody = document.getElementById("tablaUsuarios");
    if (!tbody) return;
    const busqueda = document.getElementById('buscarUsuario').value.toLowerCase();
    const filtroRol = document.getElementById('filtroRol').value;
    const filtroEstado = document.getElementById('filtroEstado').value;
    let usuariosFiltrados = [...usuariosCache];
    if (busqueda) {
        usuariosFiltrados = usuariosFiltrados.filter(u =>
            u.username?.toLowerCase().includes(busqueda) ||
            u.first_name?.toLowerCase().includes(busqueda) ||
            u.last_name?.toLowerCase().includes(busqueda) ||
            u.email?.toLowerCase().includes(busqueda)
        );
    }
    if (filtroRol) {
        usuariosFiltrados = usuariosFiltrados.filter(u => u.role_id == filtroRol);
    }
    if (filtroEstado !== '') {
        usuariosFiltrados = usuariosFiltrados.filter(u =>
            u.is_active == parseInt(filtroEstado)
        );
    }
    tbody.innerHTML = '';
    if (usuariosFiltrados.length === 0) {
        tbody.innerHTML = `
<tr>
<td colspan="7" style="text-align:center; padding:20px; color:#9ca3af;">
                    No se encontraron usuarios
</td>
</tr>
        `;
        return;
    }
    tbody.innerHTML = usuariosFiltrados.map(u => {
        const isAdmin = u.role?.name === "Administrador";
        const ultimoAcceso = formatearUltimoAcceso(u);
        return `
<tr>
<td><strong>${u.username}</strong></td>
<td>${u.first_name} ${u.last_name || ''}</td>
<td>${u.email || '-'}</td>
<td>
<span class="${isAdmin ? 'badge-admin' : 'badge-empleado-tabla'}">
<i class="fa-solid ${isAdmin ? 'fa-user-shield' : 'fa-user'}"></i>
                        ${u.role?.name || 'Empleado'}
</span>
</td>
<td>
<span class="${u.is_active ? 'estado-activo' : 'estado-inactivo'}">
                        ${u.is_active ? 'Activo' : 'Inactivo'}
</span>
</td>
<td>${ultimoAcceso}</td>
<td class="acciones">
<button class="btn-ver" onclick="verUsuario(${u.id})" title="Ver detalle">
<i class="fa-solid fa-eye"></i>
</button>
<button class="btn-editar" onclick="editarUsuario(${u.id})" title="Editar">
<i class="fa-solid fa-pen"></i>
</button>
<button class="btn-reset" onclick="abrirCambiarPassword(${u.id}, '${u.username}')" title="Cambiar contraseña">
<i class="fa-solid fa-key"></i>
</button>
                    ${u.is_active ? `
<button class="btn-activar" style="background:#fee2e2; color:#991b1b;"
                                onclick="toggleEstadoUsuario(${u.id}, false)" title="Suspender">
<i class="fa-solid fa-user-slash"></i>
</button>
                    ` : `
<button class="btn-activar"
                                onclick="toggleEstadoUsuario(${u.id}, true)" title="Activar">
<i class="fa-solid fa-user-check"></i>
</button>
                    `}
</td>
</tr>
        `;
    }).join('');
}
/* FORMATEAR ÚLTIMO ACCESO */
function formatearUltimoAcceso(usuario) {
    if (!usuario.created_at) return 'N/A';
    const fecha = new Date(usuario.created_at);
    const hoy = new Date();
    const esHoy = fecha.toDateString() === hoy.toDateString();
    if (esHoy) {
        return `Hoy ${fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return fecha.toLocaleDateString('es-BO');
}
/* ESTADISTICAS */
function actualizarEstadisticas() {
    const activos = usuariosCache.filter(u => u.is_active).length;
    const inactivos = usuariosCache.filter(u => !u.is_active).length;
    const admins = usuariosCache.filter(u => u.role_id == 1).length;
    const empleados = usuariosCache.filter(u => u.role_id == 2).length;
    document.getElementById('statActivos').textContent = activos;
    document.getElementById('statInactivos').textContent = inactivos;
    document.getElementById('statAdmins').textContent = admins;
    document.getElementById('statEmpleados').textContent = empleados;
}
/* FILTROS */
function configurarFiltros() {
    document.getElementById('buscarUsuario').addEventListener('input', renderizarUsuarios);
    document.getElementById('filtroRol').addEventListener('change', renderizarUsuarios);
    document.getElementById('filtroEstado').addEventListener('change', renderizarUsuarios);
}
/* CONTROL */
function configurarModales() {
    document.querySelectorAll('.modal-usuarios').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });
    document.getElementById('btnNuevoUsuario').addEventListener('click', () => {
        document.getElementById('formNuevoUsuario').reset();
        document.getElementById('modalNuevoUsuario').style.display = 'flex';
    });
}
function abrirModal(id) {
    document.getElementById(id).style.display = 'flex';
}
function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}
/* VER USUARIO */
function verUsuario(userId) {
    const usuario = usuariosCache.find(u => u.id === userId);
    if (!usuario) {
        alert('usuario no encontrado');
        return;
    }
    console.log('Ver usuario:', usuario);
    const elementos = {
        'verNombreCompleto': `${usuario.first_name || ''} ${usuario.last_name || ''}`.trim() || 'Sin nombre',
        'verUsername': `@${usuario.username || 'N/A'}`,
        'verEmail': usuario.email || 'N/A',
        'verRol': usuario.role?.name || 'N/A',
        'verEstado': usuario.is_active ? 'Activo' : 'Inactivo',
        'verFecha': usuario.created_at ? new Date(usuario.created_at).toLocaleDateString('es-BO') : 'N/A',
        'verId': usuario.id || 'N/A'
    };
    Object.keys(elementos).forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = elementos[id];
        } else {
            console.warn(`Elemento con id "${id}" no existe en el DOM`);
        }
    });
    const verEstado = document.getElementById('verEstado');
    if (verEstado) {
        verEstado.className = usuario.is_active ? 'estado-activo' : 'estado-inactivo';
    }
    abrirModal('modalVerUsuario');
}
/* EDITAR USUARIO */
function editarUsuario(userId) {
    const usuario = usuariosCache.find(u => u.id === userId);
    if (!usuario) return;
    document.getElementById('editUserId').value = usuario.id;
    document.getElementById('editNombre').value = usuario.first_name || '';
    document.getElementById('editApellido').value = usuario.last_name || '';
    document.getElementById('editUsername').value = usuario.username || '';
    document.getElementById('editEmail').value = usuario.email || '';
    document.getElementById('editRol').value = usuario.role_id || 2;
    document.getElementById('editEstado').value = usuario.is_active ? '1' : '0';
    abrirModal('modalEditarUsuario');
}
/* CAMBIAR PASSWORD */
function abrirCambiarPassword(userId, username) {
    document.getElementById('passwordUserId').value = userId;
    document.getElementById('passwordUserName').textContent = username;
    document.getElementById('formCambiarPassword').reset();
    abrirModal('modalCambiarPassword');
}
/* ESTADO ACTIVAR/SUSPENDER */
async function toggleEstadoUsuario(userId, activar) {
    const usuario = usuariosCache.find(u => u.id === userId);
    if (!usuario) return;
    const accion = activar ? 'activar' : 'suspender';
    if (!confirm(`¿Estás seguro de ${accion} al usuario "${usuario.username}"?`)) return;
    try {
        if (activar) {
            await apiCall(`/users/${userId}`, 'PUT', {
                is_active: true
            });
        } else {
            await apiCall(`/users/${userId}/suspend`, 'PUT');
        }
        alert(`Usuario ${accion}do correctamente`);
        await cargarUsuarios();
    } catch (error) {
        console.error('Error:', error);
        const mensaje = error.data?.message || `Error al ${accion} el usuario`;
        alert(mensaje);
    }
}
/* FORMULARIOS */
function configurarFormularios() {
    const camposNuevoUsuario = [
        {
            id: 'nuevoNombre',
            requerido: true,
            minLength: 2,
            maxLength: 100,
            patron: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
            mensajeError: 'solo letras, minimo 2 caracteres'
        },
        {
            id: 'nuevoApellido',
            requerido: false,
            maxLength: 100,
            patron: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
            mensajeError: 'solo letras permitidas'
        },
        {
            id: 'nuevoUsername',
            requerido: true,
            minLength: 3,
            maxLength: 50,
            patron: /^[a-zA-Z0-9_]+$/,
            mensajeError: 'solo letras, numeros y guion bajo, minimo 3 caracteres'
        },
        {
            id: 'nuevoEmail',
            requerido: true,
            esEmail: true,
            mensajeError: 'ingresa un correo valido'
        },
        {
            id: 'nuevoPassword',
            requerido: true,
            minLength: 6,
            mensajeError: 'minimo 6 caracteres'
        },
        {
            id: 'nuevoRol',
            requerido: true,
            esSelect: true,
            mensajeError: 'selecciona un rol'
        }
    ];
    camposNuevoUsuario.forEach(campo => {
        const input = document.getElementById(campo.id);
        if (!input) return;
        input.addEventListener('blur', () => validarCampoUsuario(input, campo));
        input.addEventListener('input', () => {
            if (input.classList.contains('input-error')) {
                validarCampoUsuario(input, campo);
            }
        });
    });
    const camposEditarUsuario = [
        {
            id: 'editNombre',
            requerido: true,
            minLength: 2,
            maxLength: 100,
            patron: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
            mensajeError: 'solo letras, minimo 2 caracteres'
        },
        {
            id: 'editApellido',
            requerido: false,
            maxLength: 100,
            patron: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
            mensajeError: 'solo letras permitidas'
        },
        {
            id: 'editUsername',
            requerido: true,
            minLength: 3,
            maxLength: 50,
            patron: /^[a-zA-Z0-9_]+$/,
            mensajeError: 'solo letras, numeros y guion bajo, minimo 3 caracteres'
        },
        {
            id: 'editEmail',
            requerido: true,
            esEmail: true,
            mensajeError: 'ingresa un correo valido'
        },
        {
            id: 'editRol',
            requerido: true,
            esSelect: true,
            mensajeError: 'selecciona un rol'
        }
    ];
    camposEditarUsuario.forEach(campo => {
        const input = document.getElementById(campo.id);
        if (!input) return;
        input.addEventListener('blur', () => validarCampoUsuario(input, campo));
        input.addEventListener('input', () => {
            if (input.classList.contains('input-error')) {
                validarCampoUsuario(input, campo);
            }
        });
    });
    document.getElementById('formNuevoUsuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        const esValido = validarFormularioUsuarioCompleto(camposNuevoUsuario);
        if (!esValido) {
            alert('por favor corrige los errores antes de guardar');
            const primerError = document.querySelector('#formNuevoUsuario .input-error');
            if (primerError) {
                primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                primerError.focus();
            }
            return;
        }
        const data = {
            first_name: document.getElementById('nuevoNombre').value.trim(),
            last_name: document.getElementById('nuevoApellido').value.trim() || null,
            username: document.getElementById('nuevoUsername').value.trim(),
            email: document.getElementById('nuevoEmail').value.trim(),
            password: document.getElementById('nuevoPassword').value,
            role_id: parseInt(document.getElementById('nuevoRol').value),
            is_active: true
        };
        try {
            await apiCall('/users', 'POST', data);
            alert('usuario creado correctamente');
            cerrarModal('modalNuevoUsuario');
            await cargarUsuarios();
        } catch (error) {
            console.error('error al crear usuario:', error);
            const mensaje = error.data?.message ||
                Object.values(error.data?.errors || {}).flat().join(', ') ||
                'error al crear el usuario';
            alert('error: ' + mensaje);
        }
    });
    document.getElementById('formEditarUsuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        const esValido = validarFormularioUsuarioCompleto(camposEditarUsuario);
        if (!esValido) {
            alert('por favor corrige los errores antes de guardar');
            const primerError = document.querySelector('#formEditarUsuario .input-error');
            if (primerError) {
                primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                primerError.focus();
            }
            return;
        }
        const id = document.getElementById('editUserId').value;
        const data = {
            first_name: document.getElementById('editNombre').value.trim(),
            last_name: document.getElementById('editApellido').value.trim() || null,
            username: document.getElementById('editUsername').value.trim(),
            email: document.getElementById('editEmail').value.trim(),
            role_id: parseInt(document.getElementById('editRol').value),
            is_active: document.getElementById('editEstado').value === '1'
        };
        try {
            await apiCall(`/users/${id}`, 'PUT', data);
            alert('usuario actualizado correctamente');
            cerrarModal('modalEditarUsuario');
            await cargarUsuarios();
        } catch (error) {
            console.error('error al actualizar:', error);
            const mensaje = error.data?.message ||
                Object.values(error.data?.errors || {}).flat().join(', ') ||
                'error al actualizar el usuario';
            alert('error: ' + mensaje);
        }
    });
    document.getElementById('formCambiarPassword').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('passwordUserId').value;
        const pass1 = document.getElementById('nuevaPassInput').value;
        const pass2 = document.getElementById('confirmPassInput').value;
        if (!pass1 || pass1.length < 6) {
            alert('la contraseña debe tener minimo 6 caracteres');
            document.getElementById('nuevaPassInput').focus();
            return;
        }
        if (pass1 !== pass2) {
            alert('las contraseñas no coinciden');
            document.getElementById('confirmPassInput').focus();
            return;
        }
        try {
            await apiCall(`/users/${id}/password`, 'PUT', {
                password: pass1,
                password_confirmation: pass2
            });
            alert('contraseña actualizada correctamente');
            cerrarModal('modalCambiarPassword');
        } catch (error) {
            console.error('error:', error);
            const mensaje = error.data?.message ||
                Object.values(error.data?.errors || {}).flat().join(', ') ||
                'error al cambiar la contraseña';
            alert('error: ' + mensaje);
        }
    });
}
function validarCampoUsuario(input, config) {
    const errorEl = document.getElementById(`error${input.id.charAt(0).toUpperCase() + input.id.slice(1)}`);
    const valor = input.value.trim();
    let mensajeError = '';
    input.classList.remove('input-error', 'input-valido');
    if (errorEl) errorEl.textContent = '';
    if (config.requerido && !valor) {
        mensajeError = 'este campo es obligatorio';
    }
    else if (valor) {
        if (config.minLength && valor.length < config.minLength) {
            mensajeError = `minimo ${config.minLength} caracteres`;
        }
        else if (config.maxLength && valor.length > config.maxLength) {
            mensajeError = `maximo ${config.maxLength} caracteres`;
        }
        else if (config.patron && !config.patron.test(valor)) {
            mensajeError = config.mensajeError || 'formato invalido';
        }
        else if (config.esEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(valor)) {
                mensajeError = 'ingresa un correo valido';
            }
        }
        else if (config.esSelect && !valor) {
            mensajeError = 'selecciona una opcion';
        }
    }
    if (mensajeError) {
        input.classList.add('input-error');
        if (errorEl) errorEl.textContent = mensajeError;
        return false;
    } else if (valor) {
        input.classList.add('input-valido');
        return true;
    }
    return true;
}
function validarFormularioUsuarioCompleto(campos) {
    let todosValidos = true;
    campos.forEach(campo => {
        const input = document.getElementById(campo.id);
        if (!input) return;
        const esValido = validarCampoUsuario(input, campo);
        if (!esValido) todosValidos = false;
    });
    return todosValidos;
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