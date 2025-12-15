import React from 'react';

const ConfirmacionExitosa = () => {
    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.icon}>
                    <span role="img" aria-label="check mark">✅</span>
                </div>
                <h1 style={styles.title}>¡Turno Confirmado con Éxito!</h1>
                <p style={styles.message}>
                    Tu reserva ha sido verificada y confirmada.
                </p>
                <p style={styles.message}>
                    Recordá que debes presentarte en Perú 222 puntualmente en el horario que reservaste.
                    No se permite el acceso a menores de edad.
                </p>
                <a href="/" style={styles.button}>
                    Volver al Inicio
                </a>
                <p style={styles.footer}>
                    Gracias por visitar la Manzana de las Luces.
                </p>
            </div>
        </div>
    );
};

// Estilos básicos para la página de éxito
const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f4f7f6',
        padding: '20px',
    },
    card: {
        backgroundColor: '#ffffff',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '450px',
        width: '100%',
    },
    icon: {
        fontSize: '4rem',
        marginBottom: '20px',
    },
    title: {
        color: '#1e3a8a', // Azul oscuro
        marginBottom: '10px',
    },
    message: {
        color: '#4b5563',
        marginBottom: '30px',
        lineHeight: '1.5',
    },
    button: {
        display: 'inline-block',
        backgroundColor: '#007bff',
        color: 'white',
        padding: '12px 25px',
        borderRadius: '5px',
        textDecoration: 'none',
        fontWeight: 'bold',
        transition: 'background-color 0.3s',
        marginTop: '15px',
    },
    footer: {
        marginTop: '30px',
        fontSize: '0.8rem',
        color: '#9ca3af',
    }
};

export default ConfirmacionExitosa;