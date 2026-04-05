const somClick = new Audio("sons/Click.mp3");
const somGameOver = new Audio("sons/Gameover.mp3");
const somStart = new Audio("sons/Start.mp3");
const trilhaSonora = new Audio("sons/musica-fundo.mp3");
trilhaSonora.loop = true; // Faz a música recomeçar sozinha
trilhaSonora.volume = 0.3; // Deixa mais baixa para não atrapalhar os efeitos
const METAS_NIVEL = [500, 1200, 2500, 4500, 7000]; // Metas reais de Score
const somAlertaFila = new Audio("sons/alerta.mp3");
const somBossSpawn = new Audio("sons/boss-chegou.mp3");
const somTempoBonus = new Audio("sons/bonus.mp3");
const somLevelUp = new Audio("sons/LevelUp.mp3");
const somVitoria = new Audio("sons/vitoria.mp3");

// Centralização de todos os elementos do HTML
const DOM = {
    listaLogs: document.getElementById("listaLogs"),
    score: document.getElementById("score"),
    tempo: document.getElementById("tempo"),
    cpu: document.getElementById("cpu"),
    progresso: document.getElementById("progresso"),
    fila: document.getElementById("fila"),
    infoFila: document.getElementById("infoFilaLimite"),
    rankingLista: document.getElementById("rankingLista"),
    telaInicio: document.getElementById("telaInicio"),
    telaJogo: document.getElementById("telaJogo"),
    bootText: document.getElementById("bootText"),
    overlayGameOver: document.getElementById("overlayGameOver"),
    proximaMeta: document.getElementById("proximaMeta"), 
    nivelExibicao: document.getElementById("nivelExibicao")

};

somClick.volume = 0.5;
somGameOver.volume = 0.5;
somStart.volume = 0.5;
somAlertaFila.volume = 0.4;
somBossSpawn.volume = 0.6;
somLevelUp.volume = 0.5;
somVitoria.volume = 0.5;

let nivelAtual = 1; 
let fila = [];
let cpuLivre = true;
let score = 0;
let jogoAtivo = false;
let spawnInterval = null;

let modoJogo = "normal";
let tempoRestante = 60;
let intervaloTempo = null;
let processosConcluidos = 0;
let processTimer = null;

let dificuldade = 3500;
let limiteFila = 10;

let ranking = JSON.parse(localStorage.getItem("ranking_processpanic")) || [];

function abrirTutorial() {
    const conteudo = document.getElementById("tutorialConteudo");
    const titulo = document.getElementById("tutorialTitulo");
    const modal = document.getElementById("modalManual");
    
    if (titulo) titulo.innerText = "MANUAL DE OPERAÇÃO";
    
    if (conteudo) {
        conteudo.innerHTML = `
            <div class="modo-info-normal">
                <strong style="color: #00ffcc;">🔹 MODO NORMAL:</strong><br>
                Foque em bater as <strong>Metas de Score</strong> para subir de nível. 
                A fila suporta 10 processos. Se lotar, é Game Over!
            </div>

            <div class="modo-info-desafio">
                <strong style="color: #ff0055;">⚡ MODO DESAFIO:</strong><br>
                Você tem <strong>60 segundos</strong>. Cada processo concluído dá pontos, mas 
                derrotar um <span style="color: #ff0055;">BOSS</span> recupera <strong>+5s</strong> de tempo!
            </div>

            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 15px 0;">

            <p><span>🟢</span> <strong>Prio Baixa:</strong> Rápido e seguro.</p>
            <p><span>🟡</span> <strong>Prio Média:</strong> Equilíbrio de tempo/pontos.</p>
            <p><span>🔴</span> <strong>Prio Crítica:</strong> Lento, mas rende muito Score.</p>
            <p><span>⚠️</span> <strong>BOSS:</strong> Ocupa a CPU por 6s, mas garante sua sobrevivência!</p>
        `;
    }

    if (modal) modal.style.display = "flex";
}

function fecharTutorial() {
    const modal = document.getElementById("modalManual");
    if (modal) modal.style.display = "none";
}

function ativarAudio() {
    somStart.currentTime = 0;
    somStart.play().catch(() => {});
}
function iniciarModoDesafio() {
    modoJogo = "desafio";
    entrarNoJogo();
}

function entrarNoJogo() {
    // 1. Tenta tocar o som de forma segura
    if (somStart) {
        somStart.currentTime = 0;
        somStart.play().catch(e => {
            console.log("Áudio bloqueado pelo navegador, mas o jogo vai iniciar.");
        });
    }

    // 2. Esconde o menu usando o objeto DOM que já criamos
    DOM.telaInicio.style.display = "none";

    // 3. Mostra o jogo com FLEX
    DOM.telaJogo.style.display = "flex"; 
    
    // 4. Inicia a lógica
    jogoAtivo = true;
    iniciarJogo();
}

function iniciarJogo() {
	document.body.classList.remove("vitoria-ativa");
	
    jogoAtivo = true;
    score = 0;
    nivelAtual = 1;
    processosConcluidos = 0;
    fila = [];
	atualizarFila();

    if (modoJogo === "desafio") {
        dificuldade = 1500; // Muito mais rápido
        limiteFila = 10;
        tempoRestante = 60;

        clearInterval(intervaloTempo);
        intervaloTempo = setInterval(() => {
            if (!jogoAtivo) return;
            tempoRestante--;
            atualizarHUDTempo();

            // A cada 15 segundos no desafio, fica mais difícil independente do score
            if (tempoRestante > 0 && tempoRestante % 15 === 0) {
                dificuldade = Math.max(600, dificuldade - 300);
                iniciarSpawn();
                adicionarLog("ALERTA: Sobrecarga de sistema detectada!", "erro");
            }

            if (tempoRestante <= 0) {
                gameOver();
            }
        }, 1000);
    } else {
        dificuldade = 3000;
        limiteFila = 10;
        if (intervaloTempo) clearInterval(intervaloTempo);
    }

    resetHUD();
    iniciarSpawn();
}

function resetHUD() {
    DOM.score.innerText = score;
    document.getElementById("progresso").style.width = "0%";

    const tempoEl = document.getElementById("tempo");
    tempoEl.style.display = (modoJogo === "desafio") ? "block" : "none";
    tempoEl.innerText = tempoRestante;
}

function atualizarHUDTempo() {
    document.getElementById("tempo").innerText = tempoRestante;
}

function iniciarSpawn() {
    if (spawnInterval) clearInterval(spawnInterval);

    // 1. Definimos um tempo inicial dependendo do modo
    // No Desafio começa em 2 segundos (2000ms), no Normal em 3 segundos (3000ms)
    let tempoBase = (modoJogo === "desafio") ? 2000 : 3000;

    // 2. Cálculo de aceleração por nível
    // Reduzimos 200ms para cada nível que o jogador sobe
    let aceleracao = (nivelAtual - 1) * 100;

    // 3. O SEGREDO: O Limite (Cap)
    // O Math.max garante que o intervalo NUNCA seja menor que 1.4 segundos no Desafio
    // e 1.5 segundos no Normal. Sem isso, o jogo vira um "spam" infinito.
    let limiteVelocidade = (modoJogo === "desafio") ? 1500 : 1800;
    
    let intervaloFinal = Math.max(tempoBase - aceleracao, limiteVelocidade);

    spawnInterval = setInterval(() => {
        if (jogoAtivo) {
            adicionarProcesso();
        }
    }, intervaloFinal);

    // Log para você testar se a velocidade está boa
    console.log(`Spawn a cada: ${intervaloFinal}ms | Nível: ${nivelAtual}`);
}

function adicionarProcesso() {
    if (!jogoAtivo) return;

    // Verificar se a fila ESTOUROU o limite antes de adicionar
    // Se o limite é 10, o jogador perde quando o 11º processo tentaria entrar
    if (fila.length >= limiteFila) {
        somAlertaFila.play().catch(() => {});
        gameOver();
        return; // Interrompe a função para não adicionar o 11º
    }

    const ehBoss = Math.random() < 0.10;

    const novoProcesso = {
        id: Math.floor(Math.random() * 9000) + 1000,
        prioridade: ehBoss ? 15 : Math.floor(Math.random() * 10) + 1,
        tempo: ehBoss ? 6 : Math.floor(Math.random() * 7) + 3,
        chegada: Date.now(),
        isBoss: ehBoss
    };

    fila.push(novoProcesso);
    atualizarFila(); // Esta função já vai atualizar o texto "X / 10" agora
    
    if (ehBoss) {
        adicionarLog("⚠️ ALERTA: PROCESSO BOSS DETECTADO!", "erro");
        somBossSpawn.play().catch(() => {});
    } else {
        adicionarLog(`Novo processo ID-${novoProcesso.id} na fila.`, "info");
    }
}

function executarProcesso(index) {
    if (!cpuLivre || !jogoAtivo) return;

    // Feedback sonoro do clique
    if (somClick) {
        somClick.currentTime = 0; 
        somClick.play().catch(() => {});
    }

    const p = fila.splice(index, 1)[0];
    cpuLivre = false;
    atualizarFila();

    let classeCor = "prio-baixa";
    if (p.prioridade > 3 && p.prioridade <= 7) classeCor = "prio-media";
    if (p.prioridade > 7) classeCor = "prio-alta";

    DOM.cpu.className = `ocupado ${classeCor}`;

	DOM.cpu.classList.add("cpu-processando");

    if (p.isBoss) {
        DOM.cpu.classList.add("cpu-boss-active");
        DOM.progresso.classList.add("progresso-boss");
    } else {
        DOM.progresso.classList.remove("progresso-boss");
    }

    let multiplicadorModo = (modoJogo === "desafio") ? 1.5 : 1;
    const pontosDesteProcesso = Math.round((p.tempo * p.prioridade * 10) * multiplicadorModo);

    DOM.cpu.innerHTML = `
        <div class="card-cpu">
            <span class="label-cpu">${p.isBoss ? "🔥 CRITICAL BOSS 🔥" : "PROCESSANDO..."}</span>
            <strong class="id-cpu">ID: ${p.id.toString().slice(-4)}</strong>
            <div class="pontuacao-cpu">💰 +${pontosDesteProcesso} PTS</div>
        </div>`;

    let progresso = 0;
    const tempoTotal = p.tempo * 1000;
    const intervalo = 100;

    if (processTimer) clearInterval(processTimer); 

    processTimer = setInterval(() => {
        if (!jogoAtivo) {
            clearInterval(processTimer);
            return;
        }
        progresso += (intervalo / tempoTotal) * 100;
        if (DOM.progresso) DOM.progresso.style.width = `${progresso}%`;

        if (progresso >= 100) {
            clearInterval(processTimer);
            finalizarProcesso(p);
        }
    }, intervalo);
}

function finalizarProcesso(processoOriginal) {
    resetarEstadoCPU(); 
    
    let multiplicadorModo = (modoJogo === "desafio") ? 1.5 : 1;
    let pontosGanhos = Math.round((processoOriginal.tempo * processoOriginal.prioridade * 10) * multiplicadorModo);
    
    score += pontosGanhos;
    processosConcluidos++;
    
    if (processoOriginal.isBoss) {
        if (modoJogo === "desafio") {
            tempoRestante += 5; 
            if (DOM.tempo) DOM.tempo.innerText = tempoRestante;
            
            // Som de bônus com reset de tempo
            if (somTempoBonus) {
                somTempoBonus.currentTime = 0;
                somTempoBonus.play().catch(() => {});
            }
            adicionarLog(`🔥 BOSS DERROTADO! BÔNUS DE +5s!`, "sucesso");
        } else {
            adicionarLog(`🔥 BOSS DERROTADO! SISTEMA ESTABILIZADO!`, "sucesso");
        }
        
        DOM.cpu.classList.remove("cpu-boss-active");
        DOM.progresso.classList.remove("progresso-boss");
    } else {
        adicionarLog(`Processo ${processoOriginal.id.toString().slice(-4)} concluído!`, "sucesso");
    }
    
    if (DOM.score) DOM.score.innerText = score;
    verificarNivel();
}

function atualizarScore() {
    DOM.score.innerText = score;
    const nivelAtual = Math.floor(score / 500) + 1;
    DOM.nivelExibicao.innerText = `NÍVEL ${nivelAtual}`;
}

function atualizarTextoFila() {
    if (!DOM.infoFila) return;
    
    DOM.infoFila.innerText = `${fila.length} / ${limiteFila}`;

    // Se faltarem apenas 2 espaços, o contador fica vermelho
    if (fila.length >= limiteFila - 2) {
        DOM.infoFila.style.color = "#ff0055";
        DOM.infoFila.style.textShadow = "0 0 10px #ff0055";
    } else {
        DOM.infoFila.style.color = "#00ffcc";
        DOM.infoFila.style.textShadow = "0 0 10px #00ffcc";
    }
}

function atualizarFila() {
    DOM.fila.innerHTML = "";
    
    fila.forEach((p, index) => {
        const li = document.createElement("li");
        
        let emoji = "🟢";
        let classeCor = "prioridade-baixa";
        let nomePrioridade = "Baixa";
        
        if (p.prioridade > 3 && p.prioridade <= 7) {
            emoji = "🟡";
            classeCor = "prioridade-media";
            nomePrioridade = "Média";
        } else if (p.prioridade > 7) {
            emoji = "🔴";
            classeCor = "prioridade-alta";
            nomePrioridade = "Crítica";
        }

        li.classList.add("processo-card");
        li.classList.add(classeCor);
        
        if (p.isBoss) {
            li.classList.add("boss");
            emoji = "⚠️";
            nomePrioridade = "BOSS";
        }
        
        // 1. Calculamos o valor REAL (com o bônus do desafio)
        let multiplicadorAtual = (modoJogo === "desafio") ? 1.5 : 1;
        let pontosVisuais = Math.round((p.tempo * p.prioridade * 10) * multiplicadorAtual);
        
        li.innerHTML = `
            <div class="info-card">
                <span class="emoji-prioridade">${emoji}</span>
                <div>
                    <strong>ID: ${p.id.toString().slice(-4)}</strong>
                    <span class="texto-prioridade">${p.isBoss ? "CRITICAL BOSS" : "Prio: " + p.prioridade + " (" + nomePrioridade + ")"}</span>
                    <small>💰 +${pontosVisuais} pts</small> 
                </div>
            </div>
            <div class="tempo-badge">⏱️ ${p.tempo}s</div>
        `;

        li.onclick = () => {
            if (cpuLivre && jogoAtivo) {
                animarParaCPU(li);
                executarProcesso(index);
            }
        };
        DOM.fila.appendChild(li);
    });
    atualizarTextoFila();
}

function gameOver() {
    jogoAtivo = false;
    clearInterval(spawnInterval);
    clearInterval(intervaloTempo);
    if (processTimer) clearInterval(processTimer); 

    // Para sons de alerta e música
    if (somAlertaFila) {
        somAlertaFila.pause();
        somAlertaFila.currentTime = 0;
    }
    if (trilhaSonora) {
        trilhaSonora.pause();
        trilhaSonora.currentTime = 0;
    }

    // Toca o som de derrota
    if (somGameOver) somGameOver.play().catch(() => {});

    const display = document.getElementById("pontuacaoFinalDisplay");
    if (display) display.innerText = score;

    const campoNome = document.getElementById("nomeJogador");
    if (campoNome) {
        campoNome.disabled = false;
        campoNome.style.opacity = "1";
        campoNome.value = ""; 
    }

    const btnSalvar = document.querySelector("#overlayGameOver button[onclick*='salvar']");
    if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.innerText = "SALVAR SCORE";
        btnSalvar.style.background = ""; 
        btnSalvar.style.opacity = "1";
    }

    if (DOM.overlayGameOver) {
        DOM.overlayGameOver.style.display = "flex";
    }
    
    adicionarLog("COLAPSO DO SISTEMA!", "erro");
}

function renderRanking() {
    DOM.rankingLista.innerHTML = "";
    ranking.forEach(p => {
        const li = document.createElement("li");
        li.innerText = `${p.nome} - ${p.pontos}`;
        DOM.rankingLista.appendChild(li);
    });
}

// Para manter a compatibilidade se você chamou de finalizarJogo em algum lugar:
function finalizarJogo() {
    gameOver();
}

function resetarEstadoCPU() {
    if (processTimer) clearInterval(processTimer);
    cpuLivre = true; 
    if (DOM.progresso) DOM.progresso.style.width = "0%"; 
    if (DOM.cpu) {
        DOM.cpu.innerText = "CPU LIVRE";
		DOM.cpu.classList.remove("cpu-processando");
        DOM.cpu.className = ""; 
    }
}

function reiniciarJogo() {
    // 1. Remove o efeito visual de vitória (dourado) imediatamente
    document.body.classList.remove("vitoria-ativa");
    
    // 2. Esconde o overlay de Game Over / Vitória
    if (DOM.overlayGameOver) DOM.overlayGameOver.style.display = "none";
    
	if (DOM.telaJogo) DOM.telaJogo.style.display = "flex";
    if (DOM.telaInicio) DOM.telaInicio.style.display = "none";
	
    // 3. Reset da Música e Sons
    if (trilhaSonora) {
        trilhaSonora.currentTime = 0;
        trilhaSonora.play().catch(e => console.log("Erro ao tocar música:", e));
    }
    if (somStart) {
        somStart.currentTime = 0;
        somStart.play().catch(e => {});
    }

    // 4. Limpa o estado lógico
    resetarEstadoCPU(); 
    score = 0;
    nivelAtual = 1;
    fila = [];
    atualizarFila();
    jogoAtivo = true;

    // 5. Atualiza o HUD visual
    if (DOM.score) DOM.score.innerText = "0";
    if (DOM.nivelExibicao) DOM.nivelExibicao.innerText = "NÍVEL 1";
    if (DOM.proximaMeta) DOM.proximaMeta.innerText = `PRÓXIMA META: ${METAS_NIVEL[0]}`;

    // 6. Re-inicia o spawn e a lógica central
    iniciarJogo();
}

function voltarMenu() {
    // Garante a remoção da classe de vitória
    document.body.classList.remove("vitoria-ativa");
    
    jogoAtivo = false;
    resetarEstadoCPU();
    clearInterval(spawnInterval);
    clearInterval(intervaloTempo);
    
    fila = [];
    atualizarFila();
    
    if (DOM.overlayGameOver) DOM.overlayGameOver.style.display = "none";
    if (DOM.telaJogo) DOM.telaJogo.style.display = "none";
    if (DOM.telaInicio) DOM.telaInicio.style.display = "flex";
    
    if (trilhaSonora) {
        trilhaSonora.pause();
        trilhaSonora.currentTime = 0;
    }
}

function animarBoot() {
    const texto = "Inicializando sistema...";
    DOM.bootText.innerText = "";
    let i = 0;
    const interval = setInterval(() => {
        DOM.bootText.innerText += texto[i];
        i++;
        if (i >= texto.length) clearInterval(interval);
    }, 50);
}

function criarParticulas(x, y) {
    for (let i = 0; i < 10; i++) {
        const p = document.createElement("div");
        p.className = "particula";
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        document.body.appendChild(p);

        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * 50;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;

        p.animate([
            { transform: "translate(0,0)", opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 }
        ], { duration: 500, easing: "ease-out" }).onfinish = () => p.remove();
    }
}

function animarParaCPU(cardOrigem) {
    const rectOrigem = cardOrigem.getBoundingClientRect();
    const rectDestino = DOM.cpu.getBoundingClientRect();

    const clone = cardOrigem.cloneNode(true);
    clone.classList.add('animando');
    document.body.appendChild(clone);

    clone.style.position = 'fixed';
    clone.style.left = `${rectOrigem.left}px`;
    clone.style.top = `${rectOrigem.top}px`;
    clone.style.margin = '0';

    const criarRastro = setInterval(() => {
        const rectClone = clone.getBoundingClientRect();
        const p = document.createElement('div');
        p.className = 'rastro-particula';
        p.style.left = `${rectClone.left + rectClone.width / 2}px`;
        p.style.top = `${rectClone.top + rectClone.height / 2}px`;
        document.body.appendChild(p);

        p.animate([
            { transform: 'scale(1)', opacity: 0.8 },
            { transform: 'scale(0)', opacity: 0 }
        ], { duration: 400 }).onfinish = () => p.remove();
    }, 30);

    requestAnimationFrame(() => {
        clone.style.transition = 'all 1.0s cubic-bezier(0.5, 0, 0.2, 1)';
        clone.style.left = `${rectDestino.left + rectDestino.width / 2 - rectOrigem.width / 2}px`;
        clone.style.top = `${rectDestino.top}px`;
        clone.style.opacity = '0';
    });

    clone.ontransitionend = () => {
        clearInterval(criarRastro);
        clone.remove();
    };
}

function iniciarTudo(modo) {
	document.body.classList.remove("vitoria-ativa");
	
    // 1. Resetar variáveis de estado
    score = 0;
    nivelAtual = 1; 
    processosConcluidos = 0;
    fila = [];
    jogoAtivo = true;
    cpuLivre = true;
    tempoRestante = 60;
    modoJogo = modo;

    // CONFIGURAÇÃO DO LIMITE DA FILA (Agora ambos com 10)
    if (modo === 'normal') {
        limiteFila = 10;
    } else {
        limiteFila = 10; // Alterado de 5 para 10 conforme solicitado
    }

    // 2. Configurar interface
    DOM.telaInicio.style.display = "none";
    DOM.telaJogo.style.display = "flex"; 
    
    if (DOM.score) DOM.score.innerText = "0";
    if (DOM.nivelExibicao) DOM.nivelExibicao.innerText = "NÍVEL 1";
    if (DOM.proximaMeta) DOM.proximaMeta.innerText = `PRÓXIMA META: ${METAS_NIVEL[0]}`;
    
    // Atualiza o texto da fila na tela para mostrar "0 / 10" imediatamente
    if (DOM.infoFila) DOM.infoFila.innerText = `0 / ${limiteFila}`;
    
    // 3. Iniciar as engrenagens do jogo
    atualizarFila();
    
    iniciarJogo(); 

    if (somStart) somStart.play().catch(() => {});
    if (trilhaSonora) trilhaSonora.play().catch(() => {});
    
    adicionarLog(`Sistema iniciado no modo: ${modo.toUpperCase()}`, "sucesso");
}

function adicionarLog(mensagem, tipo = "info") {
    const log = document.createElement("div");
    log.style.marginBottom = "8px";
    log.style.padding = "5px 10px";
    log.style.borderLeft = "4px solid #888";
    log.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
    log.style.fontSize = "0.85rem";
    log.style.borderRadius = "0 5px 5px 0";
    
    let corDestaque = "#eee";
    if (tipo === "sucesso") corDestaque = "#00ffcc";
    if (tipo === "alerta") corDestaque = "#ffff00";
    if (tipo === "erro") corDestaque = "#ff0033";

    log.style.borderColor = corDestaque;
    log.style.color = corDestaque; 

    const agora = new Date();
    const hora = agora.getHours().toString().padStart(2, '0');
    const min = agora.getMinutes().toString().padStart(2, '0');
    const seg = agora.getSeconds().toString().padStart(2, '0');

    log.innerHTML = `<span style="color: #888; font-family: monospace;">[${hora}:${min}:${seg}]</span> ${mensagem}`;
    
    DOM.listaLogs.prepend(log);

    if (DOM.listaLogs.childNodes.length > 20) {
        DOM.listaLogs.removeChild(DOM.listaLogs.lastChild);
    }
}


function salvarPontuacao() {
    // 1. Captura o elemento do input
    const campoNome = document.getElementById("nomeJogador");
    
    // 2. Pega o valor e remove espaços extras
    const nome = campoNome ? campoNome.value.trim() : "";
    
    // 3. Validação simples
    if (nome === "") {
        alert("Por favor, digite seu nome para o ranking!");
        return;
    }

    // 4. Cria o objeto da nova pontuação
    const novaEntrada = {
        nome: nome.toUpperCase(), 
        score: score,
        data: new Date().toLocaleDateString()
    };

    // 5. Adiciona ao array global, ordena e limita aos 5 melhores
    ranking.push(novaEntrada);
    ranking.sort((a, b) => b.score - a.score);
    ranking = ranking.slice(0, 5);

    // 6. Salva no LocalStorage
    localStorage.setItem("ranking_processpanic", JSON.stringify(ranking));
    
    // 7. Atualiza a parte visual e o log
    atualizarRankingUI();
    adicionarLog(`Score de ${score} salvo para ${nome}!`, "sucesso");
    
    // 8. Feedback visual no botão
    if(campoNome) {
        campoNome.disabled = true;
        campoNome.style.opacity = "0.5";
    }
    
    const btn = document.querySelector("#overlayGameOver button[onclick*='salvar']");
    if(btn) {
        btn.innerText = "✅ SALVO";
        btn.disabled = true;
        btn.style.background = "#555";
        btn.style.boxShadow = "none";
    }

    // 9. NOVIDADE: Volta para o menu inicial após um pequeno delay
    setTimeout(() => {
		jogoAtivo = false;
		resetarEstadoCPU();
		clearInterval(spawnInterval);
		clearInterval(intervaloTempo);
		fila = [];
		atualizarFila();
		
		document.body.classList.remove("vitoria-ativa");
		
        // Esconde as telas de jogo e game over
        DOM.overlayGameOver.style.display = "none";
        DOM.telaJogo.style.display = "none";
        
        // Mostra a tela de início (menu)
        DOM.telaInicio.style.display = "flex";
        
        // Opcional: Se quiser que o jogo "limpe" tudo para a próxima vez, descomente a linha abaixo:
        // location.reload();
    }, 1500); // 1500ms = 1.5 segundos
}

function atualizarRankingUI() {
    if (!DOM.rankingLista) return;
    DOM.rankingLista.innerHTML = "";

    ranking.forEach((item, index) => {
        const li = document.createElement("li");
        
        // Adiciona a classe rank-1, rank-2, etc. para o CSS saber quem pulsar
        li.classList.add(`rank-${index + 1}`);

        let medalha = "";
        if (index === 0) medalha = "🥇 1°  ";
        else if (index === 1) medalha = "🥈 2°  ";
        else if (index === 2) medalha = "🥉 3°  ";
        else medalha = `${index + 1}º `;

        li.innerHTML = `
            <span class="rank-nome-container">${medalha}${item.nome.toUpperCase()}</span>
            <span class="rank-pontos">${item.score} PTS</span>
        `;
        DOM.rankingLista.appendChild(li);
    });
}

function verificarNivel() {
    // Verificamos se o score atingiu a meta do nível atual
    if (nivelAtual <= METAS_NIVEL.length && score >= METAS_NIVEL[nivelAtual - 1]) {
        
        // --- PAUSA O JOGO E LIMPA TUDO ---
        jogoAtivo = false;                // Para as ações do jogador (cliques)
        clearInterval(spawnInterval);     // Para o surgimento de novos cards
        fila = [];                        // Zera o array da fila internamente
        atualizarFila();                  // Limpa a fila visualmente no HTML
        
        // Sobe o nível
        nivelAtual++;
		
        // Atualiza o HUD da próxima meta
		if (DOM.proximaMeta) {
            if (nivelAtual <= METAS_NIVEL.length) {
                DOM.proximaMeta.innerText = `PRÓXIMA META: ${METAS_NIVEL[nivelAtual - 1]}`;
            } else {
                DOM.proximaMeta.innerText = `META FINAL ATINGIDA!`;
            }
        }
		
        // Atualiza o texto do nível no HUD
        if (DOM.nivelExibicao) {
            DOM.nivelExibicao.innerText = `NÍVEL ${nivelAtual}`;
        }

        // Verifica se o jogador venceu o jogo (passou do nível 5)
        if (nivelAtual > 5) {
            vitoriaTotal();
        } else {
            // Se não venceu tudo, mostra o card de Level Up e pausa para o clique
            exibirCardNivel(nivelAtual); 
            adicionarLog(`SISTEMA REINICIALIZADO: Nível ${nivelAtual}!`, "alerta");
        }
    }
}

function exibirCardNivel(nivel) {
    // Toca som de Level Up
    if (somLevelUp) {
        somLevelUp.currentTime = 0;
        somLevelUp.play().catch(() => {});
    }

    const card = document.createElement("div");
    card.className = "level-card";
    
    card.innerHTML = `
        <div class="glass-container" style="border: 2px solid #00ffcc; text-align: center;">
            <h2 class="neon-text">🚀 LEVEL UP! 🚀</h2>
            <p style="color: white;">✨ Você avançou para o <strong>NÍVEL ${nivel}</strong> ✨</p>
            <div style="background: rgba(0,255,204,0.1); padding: 10px; border-radius: 8px; margin: 10px 0; border: 1px solid rgba(0,255,204,0.2);">
                <p style="margin:0; font-size: 14px; color: #ffffff; font-weight: bold; text-transform: uppercase;">💰 Pontuação Atual</p>
                <h3 style="margin:0; color: #00ffcc; font-size: 28px;">${score}</h3>
            </div>
            <p style="color: white; font-size: 14px;">⚡ A velocidade do sistema aumentou!</p>
            <button class="btn-start" style="margin-top: 15px;" onclick="retomarJogo(this)">BORA! 🎮</button>
        </div>
    `;
    document.body.appendChild(card);
}

function retomarJogo(botao) {
    // 1. Remove o card da tela
    const card = botao.closest(".level-card");
    if (card) card.remove();

    // 2. religa a lógica
    jogoAtivo = true;

    // 3. Reinicia o surgimento de novos processos
    iniciarSpawn();

    // 4. Avisa no log
    adicionarLog("SISTEMA ONLINE - NOVO NÍVEL INICIADO", "sucesso");
}

function vitoriaTotal() {
    jogoAtivo = false; 
    clearInterval(spawnInterval);
    clearInterval(intervaloTempo);
    if (processTimer) clearInterval(processTimer);

    if (trilhaSonora) {
        trilhaSonora.pause();
        trilhaSonora.currentTime = 0;
    }
    if (somVitoria) {
        somVitoria.play().catch(() => {});
    }

    // Ativa o efeito visual
    document.body.classList.add("vitoria-ativa");

    const titulo = document.querySelector("#overlayGameOver h2");
    const subtitulo = document.querySelector("#overlayGameOver .subtitulo");
    const displayScore = document.getElementById("pontuacaoFinalDisplay");

    if (titulo) titulo.innerText = "🏆 VITÓRIA TOTAL 🏆";
    if (subtitulo) subtitulo.innerText = "SISTEMA ESTABILIZADO: VOCÊ É UM MESTRE!";
    if (displayScore) displayScore.innerText = score;

    const campoNome = document.getElementById("nomeJogador");
    const btnSalvar = document.querySelector("#overlayGameOver button[onclick*='salvarPontuacao']");
    
    if (campoNome) {
        campoNome.disabled = false;
        campoNome.style.opacity = "1";
        campoNome.value = ""; 
        campoNome.placeholder = "DIGITE SEU NOME!";
    }
    
    if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.style.display = "block";
        
        // CORREÇÃO AQUI: Removemos o atributo antigo e criamos um novo evento
        btnSalvar.onclick = null; // Limpa eventos antigos
        btnSalvar.onclick = function() {
            salvarPontuacao(); // Salva os dados
            document.body.classList.remove("vitoria-ativa"); // Tira o dourado na hora
        };
    }

    if (DOM.overlayGameOver) DOM.overlayGameOver.style.display = "flex";
    adicionarLog("VITÓRIA TOTAL!", "sucesso");
}

window.onload = () => {
    renderRanking();
    animarBoot();

// Chamar ao carregar a página para exibir o ranking atual
atualizarRankingUI();
};
