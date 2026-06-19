document.addEventListener('DOMContentLoaded', ()=>{
  const ipInput = document.getElementById('ipInput')
  const cidrSelect = document.getElementById('cidrSelect')
  const pad = document.getElementById('pad')
  const calcBtn = document.getElementById('calcBtn')
  const clearBtn = document.getElementById('clearBtn')
  const delBtn = document.getElementById('del')
  const result = document.getElementById('result')

  // fill CIDR options
  for(let i=8;i<=32;i++){
    const opt = document.createElement('option')
    opt.value = i
    opt.textContent = `/${i}`
    if(i===24) opt.selected = true
    cidrSelect.appendChild(opt)
  }

  pad.addEventListener('click', e=>{
    if(!e.target.matches('button')) return
    const v = e.target.textContent
    if(v === '⌫'){
      ipInput.value = ipInput.value.slice(0,-1)
    } else {
      ipInput.value += v
    }
  })

  delBtn.addEventListener('click', ()=>{
    ipInput.value = ipInput.value.slice(0,-1)
  })

  clearBtn.addEventListener('click', ()=>{
    ipInput.value = ''
    result.innerHTML = ''
  })

  calcBtn.addEventListener('click', async ()=>{
    const ip = ipInput.value.trim()
    const cidr = parseInt(cidrSelect.value, 10)
    result.innerHTML = ''

    // client-side validation: basic IPv4 format
    if(!isValidIPv4(ip)){
      result.innerHTML = `<div class="muted">Error: IP inválida</div>`
      return
    }

    // validate that the network (ip/cidr) is fully contained in IANA private blocks
    if(!isPrivateRange(ip, cidr)){
      result.innerHTML = `<div class="muted">This is not a private IP range based on IANA IP ranges</div>`
      return
    }

    result.innerHTML = 'Calculando...'
    try{
      const res = await fetch('/api/calc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip,cidr})})
      const data = await res.json()
      if(!res.ok){
        result.innerHTML = `<div class="muted">Error: ${data.error || 'entrada inválida'}</div>`
        return
      }
      renderResult(data)
    }catch(err){
      result.innerHTML = `<div class="muted">Error de red: ${err.message}</div>`
    }
  })

  function isValidIPv4(ip){
    const parts = ip.split('.')
    if(parts.length !== 4) return false
    for(const p of parts){
      if(p.length === 0) return false
      if(!/^[0-9]+$/.test(p)) return false
      const n = Number(p)
      if(n < 0 || n > 255) return false
    }
    return true
  }

  function toInt(ip){
    const parts = ip.split('.').map(x=>Number(x))
    return (((parts[0]*256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0
  }

  function isPrivateRange(ip, cidr){
    const ipInt = toInt(ip)
    const hostCount = Math.pow(2, 32 - cidr)
    const network = Math.floor(ipInt / hostCount) * hostCount >>> 0
    const broadcast = (network + hostCount - 1) >>> 0

    const blocks = [
      {start: toInt('10.0.0.0'), end: toInt('10.255.255.255')},
      {start: toInt('172.16.0.0'), end: toInt('172.31.255.255')},
      {start: toInt('192.168.0.0'), end: toInt('192.168.255.255')}
    ]

    for(const b of blocks){
      if(network >= b.start && broadcast <= b.end) return true
    }
    return false
  }

  function renderResult(d){
    let html = `<div><strong>Red:</strong> ${d.network}</div>`
    if(d.class){
      html += `<div><strong>Clase:</strong> ${d.class}</div>`
    }
    html += `<div><strong>Total direcciones:</strong> ${d.total_addresses}</div>`
    html += `<div><strong>Direcciones utilizables:</strong> ${d.usable_addresses}</div>`
    if(d.first_available){
      html += `<div><strong>Primera IP disponible:</strong> ${d.first_available}</div>`
    } else {
      html += `<div class="muted">No hay IPs disponibles en este rango.</div>`
    }
    if(d.last_available){
      html += `<div><strong>Última IP disponible:</strong> ${d.last_available}</div>`
    }
    html += `<div style="margin-top:8px"><strong>IPs reservadas por Azure (detalles):</strong></div>`
    html += '<div class="reserved-list">'
    d.reserved.forEach(r=>{
      html += `<div><strong>${r.ip}</strong>: ${r.label}</div>`
    })
    html += '</div>'
    result.innerHTML = html
  }

})
