# Calculadora de IPs Azure (Python + Flask)

Aplicación web que calcula la primera y última IP disponible en una subred privada de Azure, considerando las direcciones reservadas por Azure (.0, .1, .2, .3 y la última dirección de broadcast).

## Ejecución local

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Abrir http://localhost:5000 en el navegador.

## Docker

Construye la imagen desde la raíz del proyecto:

```bash
docker build -f Docker/Dockerfile -t azure-ip-calculator .
```

Ejecuta el contenedor:

```bash
docker run --rm -p 5000:5000 azure-ip-calculator
```

Luego abre http://localhost:5000.

## Despliegue en Azure

Recomendado:
- Azure App Service (Linux) con Python

Puedes desplegar usando GitHub Actions o con el comando `az webapp up`.

Ejemplo rápido:

```bash
az webapp up --name calculadora-ip-azure --resource-group MiResourceGroup --runtime "PYTHON|3.12"
```

## Notas

- La app valida que la red esté dentro de los rangos privados IANA: 10.0.0.0/8, 172.16.0.0/12 y 192.168.0.0/16.
- Si la subred no está en un rango privado, muestra: `This is not a private IP range based on IANA IP ranges`.
- Para producción se usa `gunicorn` en el Dockerfile.
