#!/bin/bash
# ============================================================================
# SCRIPT DE RECUPERACIÓN DE BACKUPS - CONTROLA.Agentes
# ============================================================================
# 
# PROPÓSITO: Automatizar la recuperación de backups de forma SEGURA
# 
# REGLAS CRÍTICAS:
# - NUNCA mueve archivos, solo COPIA
# - Los backups originales permanecen INTACTOS
# - Verifica integridad antes de restaurar
#
# USO:
#   ./recuperar.sh                    # Lista backups disponibles
#   ./recuperar.sh --list             # Lista backups disponibles
#   ./recuperar.sh --restore ID       # Restaura backup específico
#   ./recuperar.sh --verify ID        # Verifica integridad de backup
#   ./recuperar.sh --latest           # Restaura último backup
#   ./recuperar.sh --help             # Muestra ayuda
#
# ============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorios
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUPS_DIR="$SCRIPT_DIR/backups"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# ============================================================================
# FUNCIONES PRINCIPALES
# ============================================================================

list_backups() {
    print_header "BACKUPS DISPONIBLES"
    
    if [ ! -d "$BACKUPS_DIR" ]; then
        print_error "Directorio de backups no existe: $BACKUPS_DIR"
        exit 1
    fi
    
    # Contar backups
    backup_count=$(ls -1d "$BACKUPS_DIR"/backup_* 2>/dev/null | wc -l)
    
    if [ "$backup_count" -eq 0 ]; then
        print_warning "No hay backups disponibles"
        exit 0
    fi
    
    print_info "Total de backups encontrados: $backup_count"
    echo ""
    echo "ID                                    | FECHA       | ESTADO"
    echo "────────────────────────────────────┼─────────────┼──────────────────"
    
    for backup_dir in "$BACKUPS_DIR"/backup_*; do
        if [ -d "$backup_dir" ]; then
            backup_id=$(basename "$backup_dir")
            # Extraer fecha del ID (backup_YYYYMMDD_HHMMSS_...)
            fecha=$(echo "$backup_id" | sed 's/backup_\([0-9]*_[0-9]*\)_.*/\1/' | tr '_' ' ')
            
            # Determinar estado según manifiesto
            estado="Desconocido"
            if [ -f "$backup_dir/MANIFIESTO.md" ]; then
                if grep -q "✅ Disponible\|✅ Estable" "$backup_dir/MANIFIESTO.md" 2>/dev/null; then
                    estado="✅ Estable"
                elif grep -q "⚠️ Testing\|⚠️ EN TESTING" "$backup_dir/MANIFIESTO.md" 2>/dev/null; then
                    estado="⚠️  Testing"
                elif grep -q "❌" "$backup_dir/MANIFIESTO.md" 2>/dev/null; then
                    estado="❌ Problemático"
                fi
            fi
            
            printf "%-36s | %-11s | %s\n" "$backup_id" "$fecha" "$estado"
        fi
    done
    
    echo ""
    print_info "Para restaurar: $0 --restore <ID_DEL_BACKUP>"
}

verify_backup() {
    local backup_id="$1"
    local backup_dir="$BACKUPS_DIR/$backup_id"
    
    print_header "VERIFICANDO BACKUP: $backup_id"
    
    # Verificar que existe
    if [ ! -d "$backup_dir" ]; then
        print_error "Backup no encontrado: $backup_id"
        exit 1
    fi
    
    local errors=0
    
    # Verificar archivos críticos
    echo "Verificando archivos..."
    
    # Archivos que pueden estar en raíz o en subcarpetas
    declare -a files_to_check=(
        "app.js"
        "server/index.js:index.js"
        "server/store.js:store.js"
    )
    
    for file_spec in "${files_to_check[@]}"; do
        # Separar ruta esperada y alternativa
        IFS=':' read -r expected_path alt_path <<< "$file_spec"
        
        file_path=""
        display_path=""
        
        # Verificar ruta esperada primero
        if [ -f "$backup_dir/$expected_path" ]; then
            file_path="$backup_dir/$expected_path"
            display_path="$expected_path"
        # Verificar ruta alternativa
        elif [ -n "$alt_path" ] && [ -f "$backup_dir/$alt_path" ]; then
            file_path="$backup_dir/$alt_path"
            display_path="$alt_path (root)"
        fi
        
        if [ -n "$file_path" ]; then
            print_success "✓ $display_path existe"
            
            # Verificar sintaxis si es .js
            if [[ "$file_path" == *.js ]]; then
                if node -c "$file_path" > /dev/null 2>&1; then
                    print_success "  └─ Sintaxis válida"
                else
                    print_error "  └─ ERROR DE SINTAXIS"
                    ((errors++))
                fi
            fi
        else
            print_warning "  └─ $expected_path no existe (opcional)"
        fi
    done
    
    # Verificar manifiesto
    if [ -f "$backup_dir/MANIFIESTO.md" ]; then
        print_success "✓ MANIFIESTO.md existe"
    else
        print_warning "⚠️  MANIFIESTO.md no existe"
    fi
    
    # Resumen
    echo ""
    if [ "$errors" -eq 0 ]; then
        print_success "Backup verificado sin errores"
        return 0
    else
        print_error "Backup tiene $errors error(s)"
        return 1
    fi
}

restore_backup() {
    local backup_id="$1"
    local backup_dir="$BACKUPS_DIR/$backup_id"
    
    print_header "RESTAURANDO BACKUP: $backup_id"
    
    # Verificar que existe
    if [ ! -d "$backup_dir" ]; then
        print_error "Backup no encontrado: $backup_id"
        print_info "Usa '$0 --list' para ver backups disponibles"
        exit 1
    fi
    
    # Verificar integridad primero
    print_info "Verificando integridad del backup..."
    if ! verify_backup "$backup_id" > /dev/null 2>&1; then
        print_warning "El backup tiene errores. ¿Continuar de todos modos?"
        read -p "Presiona Y para continuar o cualquier tecla para cancelar: " confirm
        if [ "$confirm" != "Y" ] && [ "$confirm" != "y" ]; then
            print_info "Restauración cancelada"
            exit 0
        fi
    fi
    
    # Mostrar archivos a restaurar
    echo ""
    print_info "Archivos a restaurar:"
    
    declare -a restore_files=(
        "app.js:app.js"
        "server/index.js:index.js"
        "server/store.js:store.js"
    )
    
    for file_spec in "${restore_files[@]}"; do
        IFS=':' read -r expected_path alt_path <<< "$file_spec"
        
        if [ -f "$backup_dir/$expected_path" ]; then
            echo "  → $expected_path"
        elif [ -n "$alt_path" ] && [ -f "$backup_dir/$alt_path" ]; then
            echo "  → $alt_path (como $(basename "$expected_path"))"
        fi
    done
    
    # Confirmación
    echo ""
    print_warning "Esta acción COPIARÁ archivos desde el backup al proyecto"
    print_info "El backup original permanecerá INTACTO"
    echo ""
    read -p "¿Continuar con la restauración? (y/N): " confirm
    
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        print_info "Restauración cancelada"
        exit 0
    fi
    
    # Detener servicios si PM2 está disponible
    if command -v pm2 &> /dev/null; then
        print_info "Deteniendo servicios PM2..."
        pm2 stop agentes-bot 2>/dev/null || true
        pm2 stop server 2>/dev/null || true
        sleep 2
    fi
    
    # Copiar archivos (NUNCA MOVER)
    print_info "Copiando archivos..."
    local copied=0
    
    declare -a restore_files=(
        "app.js:app.js"
        "server/index.js:index.js"
        "server/store.js:store.js"
    )
    
    for file_spec in "${restore_files[@]}"; do
        IFS=':' read -r expected_path alt_path <<< "$file_spec"
        
        source_file=""
        target_file="$PROJECT_DIR/$expected_path"
        
        # Determinar archivo de origen
        if [ -f "$backup_dir/$expected_path" ]; then
            source_file="$backup_dir/$expected_path"
        elif [ -n "$alt_path" ] && [ -f "$backup_dir/$alt_path" ]; then
            source_file="$backup_dir/$alt_path"
        fi
        
        if [ -n "$source_file" ]; then
            # Crear directorio si no existe
            target_dir="$(dirname "$target_file")"
            mkdir -p "$target_dir"
            
            # Copiar archivo
            cp "$source_file" "$target_file"
            print_success "✓ Copiado: $expected_path"
            ((copied++))
        fi
    done
    
    # Verificar que el backup sigue intacto
    echo ""
    print_info "Verificando que el backup permanece intacto..."
    local backup_intact=true
    
    for file in app.js server/index.js server/store.js; do
        if [ -f "$backup_dir/$file" ]; then
            print_success "  └─ $file sigue en backup ✓"
        fi
    done
    
    # Reiniciar servicios
    if command -v pm2 &> /dev/null; then
        print_info "Reiniciando servicios..."
        pm2 start agentes-bot 2>/dev/null || true
        pm2 start server 2>/dev/null || true
        sleep 3
        
        print_info "Verificando estado de servicios..."
        pm2 list
    fi
    
    # Resumen
    echo ""
    print_success "════════════════════════════════════════"
    print_success "  RESTAURACIÓN COMPLETADA"
    print_success "════════════════════════════════════════"
    echo ""
    print_info "Archivos copiados: $copied"
    print_info "Backup original: INTACTO ✓"
    echo ""
    print_info "Próximos pasos:"
    echo "  1. Verificar logs: pm2 logs --lines 50"
    echo "  2. Verificar API: curl http://localhost:3847/api/health"
    echo "  3. Verificar Bot: curl http://localhost:3848/api/health"
}

restore_latest() {
    print_header "RESTAURANDO ÚLTIMO BACKUP"
    
    # Encontrar el backup más reciente
    latest_backup=$(ls -td "$BACKUPS_DIR"/backup_* 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        print_error "No hay backups disponibles"
        exit 1
    fi
    
    backup_id=$(basename "$latest_backup")
    
    print_info "Último backup encontrado: $backup_id"
    restore_backup "$backup_id"
}

show_help() {
    print_header "AYUDA - SCRIPT DE RECUPERACIÓN"
    
    echo "USO:"
    echo "  $0 [OPCIÓN]"
    echo ""
    echo "OPCIONES:"
    echo "  (sin opción)      Lista backups disponibles"
    echo "  --list            Lista backups disponibles"
    echo "  --verify ID       Verifica integridad de un backup"
    echo "  --restore ID      Restaura un backup específico"
    echo "  --latest          Restaura el backup más reciente"
    echo "  --help            Muestra esta ayuda"
    echo ""
    echo "EJEMPLOS:"
    echo "  $0 --list"
    echo "  $0 --verify backup_20260222_151500_pre_hot_standby"
    echo "  $0 --restore backup_20260222_151500_pre_hot_standby"
    echo "  $0 --latest"
    echo ""
    echo "DIRECTORIOS:"
    echo "  Backups: $BACKUPS_DIR"
    echo "  Proyecto: $PROJECT_DIR"
    echo ""
    print_warning "REGLAS CRÍTICAS:"
    echo "  - Los backups NUNCA se mueven, solo se COPIAN"
    echo "  - Los backups originales permanecen INTACTOS"
    echo "  - Siempre verificar integridad antes de restaurar"
}

# ============================================================================
# MAIN
# ============================================================================

# Verificar que estamos en el directorio correcto
if [ ! -d "$BACKUPS_DIR" ]; then
    print_error "Directorio de backups no encontrado: $BACKUPS_DIR"
    print_info "Asegúrate de ejecutar este script desde la carpeta 'recuperacion'"
    exit 1
fi

# Parsear argumentos
case "${1:-}" in
    --list|-l)
        list_backups
        ;;
    --verify|-v)
        if [ -z "${2:-}" ]; then
            print_error "Debes especificar un ID de backup"
            echo "Uso: $0 --verify <ID_DEL_BACKUP>"
            exit 1
        fi
        verify_backup "$2"
        ;;
    --restore|-r)
        if [ -z "${2:-}" ]; then
            print_error "Debes especificar un ID de backup"
            echo "Uso: $0 --restore <ID_DEL_BACKUP>"
            exit 1
        fi
        restore_backup "$2"
        ;;
    --latest)
        restore_latest
        ;;
    --help|-h)
        show_help
        ;;
    "")
        list_backups
        ;;
    *)
        print_error "Opción no reconocida: $1"
        echo "Usa '$0 --help' para ver las opciones disponibles"
        exit 1
        ;;
esac
