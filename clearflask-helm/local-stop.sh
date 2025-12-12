#!/bin/bash
set -e

echo "🛑 ClearFlask Local Cleanup Script"
echo "==================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Ask for confirmation
echo -e "${YELLOW}This will uninstall ClearFlask and its dependencies from your local cluster.${NC}"
read -p "Do you want to delete persistent data too? (y/N) " -n 1 -r
echo
DELETE_DATA=$REPLY

echo ""
echo "🗑️  Uninstalling ClearFlask..."
helm uninstall clearflask 2>/dev/null && echo -e "${GREEN}✅ ClearFlask uninstalled${NC}" || echo -e "${YELLOW}⚠️  ClearFlask not found${NC}"

echo ""
echo "🗑️  Uninstalling dependencies..."
helm uninstall clearflask-deps 2>/dev/null && echo -e "${GREEN}✅ Dependencies uninstalled${NC}" || echo -e "${YELLOW}⚠️  Dependencies not found${NC}"

if [[ $DELETE_DATA =~ ^[Yy]$ ]]; then
    echo ""
    echo "🗑️  Deleting persistent volumes..."
    kubectl delete pvc -l app.kubernetes.io/instance=clearflask-deps 2>/dev/null && echo -e "${GREEN}✅ Persistent volumes deleted${NC}" || echo -e "${YELLOW}⚠️  No PVCs found${NC}"
else
    echo ""
    echo -e "${YELLOW}ℹ️  Persistent data preserved. To delete manually:${NC}"
    echo "   kubectl delete pvc -l app.kubernetes.io/instance=clearflask-deps"
fi

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo ""
echo "Remaining resources:"
kubectl get all -l app.kubernetes.io/instance=clearflask 2>/dev/null || echo "  (none)"
kubectl get all -l app.kubernetes.io/instance=clearflask-deps 2>/dev/null || echo "  (none)"
echo ""
