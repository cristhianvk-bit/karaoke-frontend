
    const API_URL = 'http://localhost:8000/api';

    document.getElementById("formularioLogin").addEventListener("submit", async function(evento) {

        evento.preventDefault();

        const usuario = document.getElementById("usuario").value;
        const contrasena = document.getElementById("contrasena").value;
        const mensajeError = document.getElementById("mensajeError");

        mensajeError.innerText = "";
        mensajeError.style.color = "red";

        try {
            const respuesta = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    login: usuario,        // Cambiado a "login"
                    password: contrasena
                })
            });

            const data = await respuesta.json();

            if (respuesta.ok && data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('usuario', JSON.stringify(data.user));

                window.location.href = "ordenes.html";
            } 
            else {
                let mensaje = "Error desconocido";

                if (data.message) {
                    mensaje = data.message;
                }
                if (data.errors) {
                    mensaje = Object.values(data.errors).flat().join(', ');
                }

                mensajeError.innerText = mensaje;
            }
        } catch (error) {
            console.error('Error de conexión:', error);
            mensajeError.innerText = "Error de conexión con el servidor";
        }
    });