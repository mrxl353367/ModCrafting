package com.modcrafting.example;

import net.fabricmc.api.ModInitializer;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.Identifier;
import net.minecraft.world.World;

/** Small acceptance example: the reward is produced by item use, never by the test command. */
public final class IronTicketMod implements ModInitializer {
    @Override
    public void onInitialize() {
        RegistryKey<Item> key = RegistryKey.of(RegistryKeys.ITEM, Identifier.of("iron_ticket", "ticket"));
        Registry.register(Registries.ITEM, key, new Item(new Item.Settings().registryKey(key).maxCount(64)) {
            @Override
            public ActionResult use(World world, PlayerEntity player, Hand hand) {
                if (world.isClient()) return ActionResult.SUCCESS;
                ItemStack held = player.getStackInHand(hand);
                if (held.isEmpty()) return ActionResult.FAIL;
                if (!player.getInventory().insertStack(new ItemStack(Items.IRON_INGOT))) return ActionResult.FAIL;
                held.decrement(1);
                return ActionResult.SUCCESS;
            }
        });
    }
}
