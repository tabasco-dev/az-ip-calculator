from flask import Flask, render_template, request, jsonify
import ipaddress

app = Flask(__name__)


def calculate_azure_reserved(network: ipaddress.IPv4Network):
    # Azure reserves the first 4 and the last IP in a subnet.
    # Return list of tuples (label, IPv4Address)
    reserved = []
    # 0: network identifier
    try:
        reserved.append(("Identificador de red (Network ID) — dirección de red (.0)", network.network_address))
    except Exception:
        pass

    # more specific labels for the next three reserved addresses with technical notes
    # .1 is typically used as the default gateway
    # .2 and .3 are reserved by Azure for platform/management purposes (por ejemplo, direccionamiento interno, servicios de control o DNS internos)
    details = [
        (1, "Puerta de enlace por defecto (gateway) — usada para enrutar tráfico saliente dentro de la subred (.1)"),
        (2, "Reservada por los servicios de plataforma de Azure — uso interno del proveedor (por ejemplo control plane / servicios internos) (.2)"),
        (3, "Reservada por los servicios de plataforma de Azure — uso interno del proveedor (por ejemplo balanceo interno / servicios) (.3)")
    ]
    for offset, label in details:
        try:
            addr = network.network_address + offset
            if addr in network:
                reserved.append((label, addr))
        except Exception:
            pass

    # last address reserved by Azure (broadcast / reservado)
    try:
        reserved.append(("Reservada por Azure — última dirección (broadcast / reservada)", network.broadcast_address))
    except Exception:
        pass

    return reserved


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/calc', methods=['POST'])
def api_calc():
    data = request.json or {}
    ip = data.get('ip', '').strip()
    cidr = data.get('cidr')
    if not ip or cidr is None:
        return jsonify({'error': 'Falta IP o CIDR'}), 400
    try:
        cidr = int(cidr)
        if cidr < 0 or cidr > 32:
            raise ValueError()
    except Exception:
        return jsonify({'error': 'CIDR inválido'}), 400

    try:
        network = ipaddress.ip_network(f"{ip}/{cidr}", strict=False)
    except Exception as e:
        return jsonify({'error': 'IP o CIDR inválido', 'detail': str(e)}), 400
    # Ensure the network is fully within IANA private ranges (RFC1918)
    private_blocks = [
        ipaddress.ip_network('10.0.0.0/8'),
        ipaddress.ip_network('172.16.0.0/12'),
        ipaddress.ip_network('192.168.0.0/16')
    ]

    contained_in_private = False
    class_label = None
    for blk, cls in zip(private_blocks, ['A', 'B', 'C']):
        if (network.network_address >= blk.network_address) and (network.broadcast_address <= blk.broadcast_address):
            contained_in_private = True
            class_label = cls
            break

    if not contained_in_private:
        return jsonify({'error': 'This is not a private IP range based on IANA IP ranges'}), 400

    total = network.num_addresses
    reserved = calculate_azure_reserved(network)
    # usable addresses after Azure reservations
    usable = max(0, total - len(reserved))

    # build set of reserved addresses for quick checks
    reserved_set = set([addr for (_label, addr) in reserved])

    # determine first available by searching from network.network_address + 1 upward
    first_available = None
    try:
        candidate = network.network_address + 1
        # Skip reserved and network address itself
        while candidate <= network.broadcast_address:
            if candidate not in reserved_set and candidate != network.network_address and candidate != network.broadcast_address:
                # also ensure candidate is within network
                if candidate >= network.network_address and candidate <= network.broadcast_address:
                    first_available = str(candidate)
                    break
            candidate += 1
    except Exception:
        first_available = None

    # determine last available by searching backward from broadcast -1
    last_available = None
    try:
        candidate = network.broadcast_address - 1
        while candidate >= network.network_address:
            if candidate not in reserved_set and candidate != network.network_address and candidate != network.broadcast_address:
                last_available = str(candidate)
                break
            candidate -= 1
    except Exception:
        last_available = None

    result = {
        'network': str(network.with_prefixlen),
        'class': class_label,
        'total_addresses': total,
        'usable_addresses': usable,
        'first_available': first_available,
        'last_available': last_available,
        'reserved': [{'label': t[0], 'ip': str(t[1])} for t in reserved]
    }
    return jsonify(result)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
