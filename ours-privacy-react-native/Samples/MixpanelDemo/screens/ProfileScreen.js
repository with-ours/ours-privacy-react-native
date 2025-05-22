import React from 'react';
import {Text, TouchableOpacity, StyleSheet, View, ScrollView} from 'react-native';
import {OursPrivacyInstance} from '../Analytics';

export default class ProfileScreen extends React.Component {

    constructor(props) {
        super(props);
        this.oursprivacy = OursPrivacyInstance;
    }

    createAlias = () => {
        this.oursprivacy.alias("New Alias", "testDistinctId");
    }

    reset = () => {
        this.oursprivacy.reset();
    }

    setProperty = () => {
        this.oursprivacy.getPeople().set({
          "a": 1,
          "b": 2.3,
          "c": ["4", 5],
        });
    }

    setOneProperty = () => {
        this.oursprivacy.getPeople().set("d", "yo");
    }

    setOnePropertyOnce = () => {
        this.oursprivacy.getPeople().setOnce("c", "just once");
    }

    unsetProperties = () => {
        this.oursprivacy.getPeople().unset("a");
    }

    incrementProperty = () => {
        this.oursprivacy.getPeople().increment("a", 1.2);
    }

    removePropertyValue = () => {
        this.oursprivacy.getPeople().remove("c", 5);
    }

    appendProperties = () => {
        this.oursprivacy.getPeople().append("e", "Hello");
    }

    unionProperties = () => {
        this.oursprivacy.getPeople().union("a", ["goodbye", "hi"]);
    }

    trackChargeWithoutProperties = () => {
        this.oursprivacy.getPeople().trackCharge(22.8);
    }

    trackCharge = () => {
        this.oursprivacy.getPeople().trackCharge(12.8, {"sandwich": 1});
    }

    clearCharges = () => {
        this.oursprivacy.getPeople().clearCharges();
    }

    deleteUser = () => {
        this.oursprivacy.getPeople().deleteUser();
    }

    /**
      Push all queued OursPrivacy events and People Analytics changes to OursPrivacy servers.
    */
    flush = () => {
        this.oursprivacy.flush();
    }

    render() {
        return (
            <ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.createAlias}>
                        <Text style={styles.buttonText}>Create Alias</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.reset}>
                        <Text style={styles.buttonText}>Reset</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.setProperty}>
                        <Text style={styles.buttonText}>Set Properties</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.setOneProperty}>
                        <Text style={styles.buttonText}>Set One Property</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.setOnePropertyOnce}>
                        <Text style={styles.buttonText}>Set Properties Once</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.unsetProperties}>
                        <Text style={styles.buttonText}>Unset Properties</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.incrementProperty}>
                        <Text style={styles.buttonText}>Increment Property</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.removePropertyValue}>
                        <Text style={styles.buttonText}>Remove Property Value</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.appendProperties}>
                        <Text style={styles.buttonText}>Append Properties</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.unionProperties}>
                        <Text style={styles.buttonText}>Union Properties</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.trackChargeWithoutProperties}>
                        <Text style={styles.buttonText}>Track Charge w/o Properties</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.trackCharge}>
                        <Text style={styles.buttonText}>Track Charge w Properties</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.clearCharges}>
                        <Text style={styles.buttonText}>Clear Charges</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.deleteUser}>
                        <Text style={styles.buttonText}>Delete User</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.flush}>
                        <Text style={styles.buttonText}>Flush</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#1E90FF',
        width: '100%',
        alignItems: 'center',
        marginVertical: 10,
        paddingVertical: 10,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#ffffff',
        textAlign: "center"
    },
    touchableOpacity: {
        backgroundColor: '#1E90FF',
        borderRadius: 25,
        width: '100%',
        alignItems: 'center',
        marginVertical: 10,
        paddingVertical: 10,
    }
})
